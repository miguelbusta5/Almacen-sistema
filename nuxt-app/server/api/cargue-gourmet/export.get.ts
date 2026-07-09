import { defineEventHandler, getQuery, setHeader } from 'h3'
import ExcelJS from 'exceljs'
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'

const ROLES_VEN = ['ADMIN', 'GERENTE', 'OPERACIONES_GOURMET', 'TRANSPORTE', 'SUPERVISOR_TRANSPORTE']

const ESTADO_LABEL: Record<string, string> = {
  BORRADOR: 'Sin ubicación',
  UBICACION_ASIGNADA: 'Ubicación asignada',
  ENVIADO_A_TRANSPORTE: 'Enviado a Transporte',
  EN_CARGUE: 'En cargue',
  CARGUE_COMPLETO: 'Cargue completo',
  CARGUE_COMPLETO_MANUAL: 'Cerrado manualmente',
  CON_NOVEDAD: 'Con novedad',
  CANCELADO: 'Cancelado',
}

function fmtFechaHora(d: Date | null): string {
  if (!d) return ''
  return new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' }).format(d)
}

// GET /api/cargue-gourmet/export — mismos filtros que GET /api/cargue-gourmet.
export default defineEventHandler(async (event) => {
  await requireRole(event, ROLES_VEN)
  const sp = getQuery(event)
  const ciudad = sp.ciudad ? String(sp.ciudad) : undefined
  const estado = sp.estado ? String(sp.estado) : undefined
  const tipoOrden = sp.tipoOrden ? String(sp.tipoOrden) : undefined
  const tipoPedido = sp.tipoPedido ? String(sp.tipoPedido) : undefined
  const q = sp.q ? String(sp.q).trim() : undefined

  const where: any = {}
  if (ciudad) where.ciudadDestino = ciudad
  if (estado) where.estado = estado
  if (tipoOrden) where.tipoOrden = tipoOrden
  if (tipoPedido === 'GOURMET' || tipoPedido === 'MUEBLES') where.tipoPedido = tipoPedido
  if (q) {
    where.OR = [
      { orden: { contains: q, mode: 'insensitive' } },
      { codigoTienda: { contains: q, mode: 'insensitive' } },
      { nombreTienda: { contains: q, mode: 'insensitive' } },
    ]
  }

  const rows = await prisma.gourmetPedido.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 5000,
    include: { creadoPor: { select: { name: true } }, estibas: { select: { ubicacion: true, secuencia: true } } },
  })

  const headers = [
    'Orden', 'Tipo', 'Código tienda', 'Nombre tienda', 'Ciudad destino',
    'Cajas esperadas', 'Estibas esperadas', 'Estado', 'Ubicaciones',
    'Creado por', 'Creado', 'Cargue completado',
  ]

  const dataRows: (string | number)[][] = rows.map((r) => {
    const ubicaciones = Array.from(
      new Set(r.estibas.slice().sort((a, b) => a.secuencia - b.secuencia).map((e) => e.ubicacion?.trim() ?? '').filter(Boolean))
    ).join(', ')
    return [
      r.orden, r.tipoOrden, r.codigoTienda, r.nombreTienda, r.ciudadDestino,
      r.cajasEsperadas, r.estibasEsperadas, ESTADO_LABEL[r.estado] ?? r.estado, ubicaciones,
      r.creadoPor?.name ?? '', fmtFechaHora(r.createdAt), fmtFechaHora(r.cargueCompletadoAt),
    ]
  })

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Cargue Gourmet')
  ws.addRows([headers, ...dataRows])
  ws.columns = [14, 8, 14, 26, 16, 10, 10, 18, 30, 20, 16, 16].map((width) => ({ width }))

  const buf = await wb.xlsx.writeBuffer()
  const today = new Date().toISOString().slice(0, 10)

  setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setHeader(event, 'Content-Disposition', `attachment; filename="cargue-gourmet-${today}.xlsx"`)
  return Buffer.from(buf)
})
