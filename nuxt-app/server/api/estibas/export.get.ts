import { defineEventHandler, getQuery, setHeader } from 'h3'
import ExcelJS from 'exceljs'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { calcularDuracionMinutos, formatDateOnly } from '../../utils/exportacionesCalc'
import { assertGestorEstibas, buildEstibaWhere, ESTIBA_INCLUDE } from '../../utils/estibas'

// GET /api/estibas/export — Excel con las mismas columnas de la planilla de
// montacargas (más pedido, duración y operario, que el Sheet no tenía), para que
// quien venía del Google Sheet reconozca el archivo.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertGestorEstibas(actor.role, 'Sin permiso para exportar')

  const sp = getQuery(event)
  const str = (v: unknown) => (v === undefined || v === null ? undefined : String(v).trim() || undefined)
  // scoped:false — el endpoint ya es gestor-only.
  const where = buildEstibaWhere(
    actor,
    { q: str(sp.q), fecha: str(sp.fecha), usuarioId: str(sp.usuarioId), estado: str(sp.estado), pedido: str(sp.pedido) },
    { scoped: false },
  )

  const registros = await prisma.estiba.findMany({
    where: where as never,
    include: ESTIBA_INCLUDE,
    orderBy: [{ horaInicio: 'desc' }],
    take: 5000,
  })

  const fmtHora = (d: Date): string =>
    new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(d)

  const headers = [
    'PEDIDO', 'PLU', 'EAN', 'DESCRIPCION', 'CAJAS', 'UNIDADES X CAJA', 'CANTIDAD TOTAL',
    'DEPOSITO FINAL', 'FECHA', 'FECHA Y HORA INICIO', 'FECHA Y HORA FINAL', 'TIEMPO (MIN)',
    'ESTADO', 'UND MANUALES', 'MOTIVO CORRECCION', 'MONTACARGUISTA',
  ]

  const rows: (string | number | null)[][] = registros.map((r) => [
    r.pedido,
    r.plu,
    r.ean ?? '',
    r.descripcion,
    r.cajas,
    r.unidadesPorCaja,
    r.cantidadTotal,
    r.ubicacion ?? '',
    formatDateOnly(r.fecha) ?? '',
    fmtHora(r.horaInicio),
    r.horaFinalizacion ? fmtHora(r.horaFinalizacion) : '',
    calcularDuracionMinutos(r.horaInicio, r.horaFinalizacion) ?? '',
    r.horaFinalizacion ? 'Cerrada' : 'En curso',
    r.unidadesManuales ? 'Sí' : 'No',
    r.motivoCorreccion ?? '',
    r.creadoPor?.name ?? '',
  ])

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Estibas')
  ws.addRows([headers, ...rows])
  ws.columns = [14, 12, 16, 40, 8, 16, 16, 18, 12, 18, 18, 13, 11, 14, 28, 22].map((width) => ({ width }))

  const buf = await wb.xlsx.writeBuffer()
  const today = new Date().toISOString().slice(0, 10)

  setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setHeader(event, 'Content-Disposition', `attachment; filename="estibas-${today}.xlsx"`)
  return Buffer.from(buf)
})
