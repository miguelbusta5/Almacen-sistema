import { defineEventHandler, getQuery, setHeader, createError } from 'h3'
import ExcelJS from 'exceljs'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { calcCostoAlmacenaje, diasTranscurridosAlmacenaje } from '../../utils/almacenaje'

// Roles que pueden exportar, más el acceso puntual (no general) para
// auxiliar-transporte@gmail.com — ver docs/cerebro/pendientes.md sobre el
// retiro de un permiso por email equivalente en Cargue Gourmet: acá se
// reintroduce acotado solo a esta exportación, a pedido explícito.
const ALLOWED_ROLES = ['ADMIN', 'GERENTE', 'TRANSPORTE', 'SUPERVISOR_TRANSPORTE']
const ALLOWED_EMAILS = ['auxiliar-transporte@gmail.com']

const ESTADO_LABEL: Record<string, string> = {
  'PENDIENTE DESPACHO': 'Pendiente despacho',
  DESPACHADO: 'Despachado',
}

// GET /api/transporte/export — mismos filtros que GET /api/transporte, más
// `estado` como elección explícita del usuario al momento de descargar
// (ver transporte.vue: el menú de Excel ya no depende del filtro de la lista).
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  if (!ALLOWED_ROLES.includes(actor.role) && !ALLOWED_EMAILS.includes(actor.email)) {
    throw createError({ statusCode: 403, statusMessage: 'No tienes permisos para exportar' })
  }

  const sp = getQuery(event)
  const q = sp.q ? String(sp.q).trim() : undefined
  const estado = sp.estado ? String(sp.estado) : undefined
  const tipo = sp.tipo ? String(sp.tipo) : undefined

  const where: any = {}
  if (estado) where.estado = estado
  if (tipo) where.tipo = tipo
  if (q) {
    where.OR = [
      { documento: { contains: q, mode: 'insensitive' } },
      { ubicacion: { contains: q, mode: 'insensitive' } },
      { clienteNombre: { contains: q, mode: 'insensitive' } },
      { clienteDocumento: { contains: q, mode: 'insensitive' } },
    ]
  }

  const rows = await prisma.transporteGuardado.findMany({
    where,
    orderBy: [{ fecha: 'desc' }, { created_at: 'desc' }],
    take: 5000,
  })

  const dataRows = rows.map((r) => {
    const fecha = r.fecha.toISOString().slice(0, 10)
    const fechaDespacho = r.fecha_despacho ? r.fecha_despacho.toISOString().slice(0, 10) : null
    return [
      r.documento,
      r.clienteNombre ?? '',
      r.clienteDocumento ?? '',
      r.tipo === 'ECOMMERCE' ? 'Ecommerce' : 'Común',
      r.codigoTienda ?? '',
      r.nombreTienda ?? '',
      r.ciudad ?? '',
      r.ubicacion,
      ESTADO_LABEL[r.estado] ?? r.estado,
      new Date(fecha + 'T00:00:00'),
      fechaDespacho ? new Date(fechaDespacho + 'T00:00:00') : null,
      diasTranscurridosAlmacenaje(fecha, fechaDespacho),
      calcCostoAlmacenaje(fecha, fechaDespacho),
      r.nota ?? '',
    ]
  })

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Guardados Transporte', { views: [{ state: 'frozen', ySplit: 1 }] })

  // Tabla real de Excel (encabezado con filtro/orden incorporado, filas en
  // bandas) en vez de filas sueltas — así el archivo abre "organizado por
  // tabla" y no como un volcado plano.
  ws.addTable({
    name: 'GuardadosTransporte',
    ref: 'A1',
    headerRow: true,
    totalsRow: false,
    style: { theme: 'TableStyleMedium9', showRowStripes: true },
    columns: [
      { name: 'Documento' },
      { name: 'Cliente' },
      { name: 'Documento cliente' },
      { name: 'Tipo' },
      { name: 'Código tienda' },
      { name: 'Nombre tienda' },
      { name: 'Ciudad' },
      { name: 'Ubicación' },
      { name: 'Estado' },
      { name: 'Fecha ingreso' },
      { name: 'Fecha despacho' },
      { name: 'Días transcurridos' },
      { name: 'Costo almacenaje acumulado' },
      { name: 'Nota' },
    ],
    rows: dataRows,
  })

  ws.columns = [18, 24, 16, 12, 14, 26, 16, 24, 18, 14, 14, 12, 20, 30].map((width) => ({ width }))
  ws.getColumn(10).numFmt = 'yyyy-mm-dd'
  ws.getColumn(11).numFmt = 'yyyy-mm-dd'
  ws.getColumn(12).numFmt = '#,##0'
  ws.getColumn(13).numFmt = '"$"#,##0'
  ws.getRow(1).font = { bold: true }
  ws.getRow(1).alignment = { vertical: 'middle' }

  const buf = await wb.xlsx.writeBuffer()
  const today = new Date().toISOString().slice(0, 10)

  setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setHeader(event, 'Content-Disposition', `attachment; filename="guardados-transporte-${today}.xlsx"`)
  return Buffer.from(buf)
})
