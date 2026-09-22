import { createError, defineEventHandler, getQuery, setHeader } from 'h3'
import ExcelJS from 'exceljs'
import { requireAuth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { actorInventario } from '../../utils/inventarioCiclico'
interface Cierre { plu: string; upc: string; descripcion: string; teorico: number; fisico: number; diferencia: number; estado: string; precio: number; proveedor: string; linea: string; observacion: string }
export default defineEventHandler(async event => {
  await actorInventario(await requireAuth(event), true)
  const c = await prisma.inventarioCiclico.findUnique({ where: { id: String(getQuery(event).id ?? '') }, include: { casos: { include: { tareas: { include: { registros: true } } } } } })
  if (!c || c.estado !== 'CERRADO' || !c.versionCierreId || !c.cierre) throw createError({ statusCode: 409, statusMessage: 'Carlos debe cerrar el cíclico antes de descargar' })
  const wb = new ExcelJS.Workbook(), cierre = c.cierre as unknown as Cierre[]
  const principal = wb.addWorksheet('Consecutivo Gourmet'), resumen = wb.addWorksheet('Hoja1'), maestro = wb.addWorksheet('maestro inv'), verificacion = wb.addWorksheet('Verificación')
  principal.addRow(['Cod. Barra','Observación','PLU','Descripción','Teorico','Cant. Contada','Dif','Estado','Precio Base','Precio de Inv Teorico','Precio de Inventario Fisico','Precio de diferencia','Linea','Proveedor'])
  resumen.addRow(['PLU','Descripción','Teorico','Cant. Contada','Dif.','Estado'])
  for (const r of cierre) {
    const estado = r.estado === 'OK' ? 'OK' : r.estado === 'FALTANTE' ? 'Faltante' : 'Sobrante'
    principal.addRow([r.upc,r.observacion,r.plu,r.descripcion,r.teorico,r.fisico,r.diferencia,estado,r.precio,r.precio*r.teorico,r.precio*r.fisico,r.precio*r.diferencia,r.linea,r.proveedor])
    resumen.addRow([r.plu,r.descripcion,r.teorico,r.fisico,r.diferencia,estado])
  }
  principal.addRow([])
  const sum = (key: 'teorico'|'fisico'|'diferencia') => cierre.reduce((n,r) => n+r[key],0)
  const valor = (key: 'teorico'|'fisico'|'diferencia') => cierre.reduce((n,r) => n+r[key]*r.precio,0)
  for (const [label,value] of [['Inventario Teorico',sum('teorico')],['Precio de Inventario teorico',valor('teorico')],['Inventario Fisico',sum('fisico')],['Precio de Inventario Fisico',valor('fisico')],['Unidades con diferencia',sum('diferencia')],['Precio de la diferencia',valor('diferencia')],['PLU Contados',cierre.length],['PLU Sin diferencia',cierre.filter(r=>r.diferencia===0).length],['Confiabilidad',cierre.length ? cierre.filter(r=>r.diferencia===0).length/cierre.length : 0]]) principal.addRow([null,null,null,label,value])
  principal.getCell(`E${principal.rowCount}`).numFmt='0.00%'
  maestro.addRow(['PLU','Nombre para mostrar','Referencia Original','Nombre del proveedor','Código UPC','Ubicación del inventario','Precio unitario','GRUPO','D. Marca'])
  const productos = await prisma.inventarioProductoPvp.findMany({ where: { versionId: c.versionCierreId }, orderBy: { plu: 'asc' } })
  for (const p of productos) maestro.addRow([p.plu,p.descripcion,p.plu,p.proveedor,p.upc,null,p.precio===null?null:Number(p.precio),p.linea,p.marca])
  const usuarios=await prisma.user.findMany({where:{id:{in:[...new Set(c.casos.flatMap(x=>x.tareas.map(t=>t.usuarioId!)))]}},select:{id:true,name:true}})
  verificacion.addRow(['Ubicación','PLU','Operario','Teórico NetSuite actualizado','Físico reconteo','Resultado','Validado por Carlos','Cerrado el','Observación'])
  for (const caso of c.casos) for(const t of caso.tareas) for(const r of t.registros) verificacion.addRow([caso.ubicacion,r.plu,usuarios.find(u=>u.id===t.usuarioId)?.name??t.usuarioId,r.teoricoActual,r.fisico,r.estado,caso.resultadoId===r.id?'Sí':'No',caso.cerradoAt,caso.observacion])
  for (const ws of wb.worksheets) {
    ws.views=[{state:'frozen',ySplit:1}]; ws.autoFilter={from:{row:1,column:1},to:{row:1,column:ws.columnCount}}
    ws.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}}; ws.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF06765A'}}
    ws.columns.forEach(col=>{col.width=22}); ws.getColumn(ws===principal?4:2).width=46
  }
  for(const n of [9,10,11,12]) principal.getColumn(n).numFmt='"$"#,##0.00'
  maestro.getColumn(7).numFmt='"$"#,##0.00'
  setHeader(event,'Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setHeader(event,'Content-Disposition',`attachment; filename="Cierre-ciclico-${c.createdAt.toISOString().slice(0,10)}.xlsx"`)
  return Buffer.from(await wb.xlsx.writeBuffer())
})
