import { defineEventHandler, getQuery, setHeader, createError } from 'h3'
import ExcelJS from 'exceljs'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { formatDateOnly } from '../../utils/exportacionesCalc'
import {
  ESTADO_MOVIMIENTO_LABEL, huboTraspaso, segundosDeAyudantes, segundosDelCreador,
  segundosTrabajados,
} from '../../utils/montacargasCalc'
import { assertGestorMontacargas, buildMovimientoWhere, MOVIMIENTO_INCLUDE } from '../../utils/montacargas'
import { esTipoMovimiento, TIPO_MOVIMIENTO_LABEL } from '../../utils/montacargasCalc'

// GET /api/montacargas/export?tipo=... - Excel con las columnas de la planilla de
// montacargas (mas reguero, ubicacion inicial, duracion y operario, que el Sheet
// no tenia), para que quien venia del Google Sheet reconozca el archivo.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertGestorMontacargas(actor.role, 'Sin permiso para exportar')

  const sp = getQuery(event)
  const str = (v: unknown) => (v === undefined || v === null ? undefined : String(v).trim() || undefined)

  const tipo = str(sp.tipo)
  if (!esTipoMovimiento(tipo)) {
    throw createError({ statusCode: 400, statusMessage: 'Tipo de registro invalido' })
  }

  // scoped:false - el endpoint ya es gestor-only.
  const where = buildMovimientoWhere(
    actor,
    tipo,
    { q: str(sp.q), fecha: str(sp.fecha), usuarioId: str(sp.usuarioId), estado: str(sp.estado) },
    { scoped: false },
  )

  const registros = await prisma.movimientoMontacargas.findMany({
    where: where as never,
    include: MOVIMIENTO_INCLUDE,
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
    'PLU', 'EAN', 'DESCRIPCION', 'CAJAS', 'UNIDADES X CAJA', 'REGUERO',
    'UNIDADES SUELTAS', 'CANTIDAD TOTAL', 'UBICACION INICIAL', 'DEPOSITO FINAL',
    // En SEGUNDOS: el trabajo de resurtido dura eso, y en minutos redondeados
    // la mitad de las filas salia en cero y no habia nada que sumar en Excel.
    'FECHA', 'FECHA Y HORA INICIO', 'FECHA Y HORA FINAL', 'TIEMPO (SEG)',
    'T. MONTACARGUISTA (SEG)', 'T. AYUDANTE (SEG)',
    'ESTADO', 'UND MANUALES', 'NOVEDAD', 'MOTIVO CORRECCION',
    'MONTACARGUISTA', 'RESPONSABLE ACTUAL',
  ]

  const rows: (string | number | null)[][] = registros.map((r) => [
    r.plu,
    r.ean ?? '',
    r.descripcion,
    r.cajas,
    r.unidadesPorCaja,
    r.hayReguero ? 'Si' : 'No',
    r.unidadesSueltas,
    r.cantidadTotal,
    r.ubicacionInicial ?? '',
    r.ubicacionFinal ?? '',
    formatDateOnly(r.fecha) ?? '',
    fmtHora(r.horaInicio),
    r.horaFinalizacion ? fmtHora(r.horaFinalizacion) : '',
    // Solo tramos trabajados: la ventana de una novedad no se cronometra.
    r.estado === 'CERRADO' ? segundosTrabajados(r.tramos) : '',
    segundosDelCreador(r.tramos, r.creadoPorId),
    huboTraspaso(r.tramos, r.creadoPorId) ? segundosDeAyudantes(r.tramos, r.creadoPorId) : '',
    ESTADO_MOVIMIENTO_LABEL[r.estado],
    r.unidadesManuales ? 'Si' : 'No',
    r.novedades?.find((n) => !n.resueltaAt) ? 'Abierta' : (r.novedades?.length ? 'Resuelta' : ''),
    r.motivoCorreccion ?? '',
    r.creadoPor?.name ?? '',
    r.responsable?.name ?? '',
  ])

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(TIPO_MOVIMIENTO_LABEL[tipo].slice(0, 31))
  ws.addRows([headers, ...rows])
  ws.columns = [12, 16, 40, 8, 16, 10, 17, 16, 18, 18, 12, 18, 18, 13, 22, 19, 12, 14, 11, 28, 22, 22]
    .map((width) => ({ width }))

  const buf = await wb.xlsx.writeBuffer()
  const today = new Date().toISOString().slice(0, 10)
  const slug = tipo.toLowerCase()

  setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setHeader(event, 'Content-Disposition', `attachment; filename="montacargas-${slug}-${today}.xlsx"`)
  return Buffer.from(buf)
})
