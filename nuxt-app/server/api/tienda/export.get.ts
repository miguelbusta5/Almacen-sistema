import { defineEventHandler, getQuery, setHeader } from 'h3'
import ExcelJS from 'exceljs'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { ESTADO_DESPACHO_LABEL } from '../../utils/mapRow'

function fmtFecha(d: Date | null): string {
  if (!d) return ''
  return new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short' }).format(d)
}
function fmtFechaHora(d: Date | null): string {
  if (!d) return ''
  return new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' }).format(d)
}

// GET /api/tienda/export — mismos filtros que GET /api/tienda.
export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const sp = getQuery(event)
  const estado = sp.estado ? String(sp.estado) : undefined
  const cc = sp.centroCostos ? String(sp.centroCostos) : undefined
  const q = sp.q ? String(sp.q).trim() : undefined

  const where: any = {}
  if (estado) where.estado = estado
  if (cc) where.centroCostos = { contains: cc, mode: 'insensitive' }
  if (q) {
    where.OR = [
      { numeroDocumento: { contains: q, mode: 'insensitive' } },
      { clienteNombre: { contains: q, mode: 'insensitive' } },
      { consecutivo: { contains: q, mode: 'insensitive' } },
    ]
  }

  const rows = await prisma.despachoTienda.findMany({
    where,
    orderBy: [{ fechaCreacion: 'desc' }, { createdAt: 'desc' }],
    take: 5000,
    include: { creadoPor: { select: { name: true } } },
  })

  const headers = [
    'Centro costos', 'N° Documento', 'Consecutivo', 'Cliente', 'Documento cliente', 'Teléfono cliente',
    'Estado', 'Ciudad', 'N° Cajas', 'Fecha creación', 'Entrega comprometida',
    'Creado por', 'Recibido', 'Entregado CEDI', 'Despachado', 'Con novedad', 'Rechazado',
  ]

  const dataRows: (string | number)[][] = rows.map((r) => [
    r.centroCostos, r.numeroDocumento, r.consecutivo, r.clienteNombre, r.clienteDocumento ?? '', r.clienteTelefono ?? '',
    ESTADO_DESPACHO_LABEL[r.estado] ?? r.estado, r.ciudad ?? '', r.numeroCajas ?? '', fmtFecha(r.fechaCreacion), fmtFecha(r.fechaEntregaComprometida),
    r.creadoPor?.name ?? '', fmtFechaHora(r.recibidoAt), fmtFechaHora(r.entregadoCediAt), fmtFechaHora(r.despachadoAt), fmtFechaHora(r.novedadAt), fmtFechaHora(r.rechazadoAt),
  ])

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Facturas Contado')
  ws.addRows([headers, ...dataRows])
  ws.columns = [16, 16, 12, 26, 16, 14, 16, 14, 9, 14, 16, 20, 16, 16, 16, 16, 16].map((width) => ({ width }))

  const buf = await wb.xlsx.writeBuffer()
  const today = new Date().toISOString().slice(0, 10)

  setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setHeader(event, 'Content-Disposition', `attachment; filename="facturas-contado-${today}.xlsx"`)
  return Buffer.from(buf)
})
