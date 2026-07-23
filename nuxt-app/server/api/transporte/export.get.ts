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

// GET /api/transporte/export — mismos filtros que GET /api/transporte.
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
    ]
  }

  const rows = await prisma.transporteGuardado.findMany({
    where,
    orderBy: [{ fecha: 'desc' }, { created_at: 'desc' }],
    take: 5000,
  })

  const headers = [
    'Documento', 'Tipo', 'Código tienda', 'Nombre tienda', 'Ciudad', 'Ubicación',
    'Estado', 'Fecha ingreso', 'Fecha despacho', 'Días transcurridos',
    'Costo almacenaje acumulado', 'Nota',
  ]

  const dataRows: (string | number)[][] = rows.map((r) => {
    const fecha = r.fecha.toISOString().slice(0, 10)
    const fechaDespacho = r.fecha_despacho ? r.fecha_despacho.toISOString().slice(0, 10) : null
    const diasTranscurridos = diasTranscurridosAlmacenaje(fecha, fechaDespacho)
    const costoAcumulado = calcCostoAlmacenaje(fecha, fechaDespacho)
    return [
      r.documento, r.tipo ?? 'COMUN', r.codigoTienda ?? '', r.nombreTienda ?? '',
      r.ciudad ?? '', r.ubicacion, r.estado, fecha, fechaDespacho ?? '',
      diasTranscurridos, costoAcumulado, r.nota ?? '',
    ]
  })

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Guardados Transporte')
  ws.addRows([headers, ...dataRows])
  ws.columns = [18, 12, 14, 26, 16, 24, 18, 14, 14, 10, 16, 30].map((width) => ({ width }))

  const buf = await wb.xlsx.writeBuffer()
  const today = new Date().toISOString().slice(0, 10)

  setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setHeader(event, 'Content-Disposition', `attachment; filename="guardados-transporte-${today}.xlsx"`)
  return Buffer.from(buf)
})
