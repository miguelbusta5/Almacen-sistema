import { defineEventHandler, getQuery, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { esGestionMuebles, inspeccionRepartida, ROL_PICKING } from '../../utils/mueblesCalc'
import { diaBogota, limitesRango } from '../../utils/indicadoresCalc'
import {
  analiticaMuebles, MAX_PLANTILLA_MUEBLES, PLANTILLA_MUEBLES_DEFECTO, type LineaAnalitica, type OrdenAnalitica,
} from '../../utils/mueblesAnaliticaCalc'

const RE_DIA = /^\d{4}-\d{2}-\d{2}$/
/** Un año basta para cualquier comparación y acota el peor caso de la consulta. */
const MAX_DIAS = 366

const SELECT_LINEA = {
  ordenId: true, plu: true, descripcion: true, unidades: true, operarioId: true,
  // El login compartido de inspeccion tambien agrega PLU: eso no es picking.
  operario: { select: { role: true } },
  horaInicio: true, horaFin: true, pausaSegundos: true,
  inspectorId: true, inspHoraInicio: true, inspHoraFin: true, inspPausaSegundos: true,
  ebanisteriaInicio: true, ebanisteriaFin: true, reposicionInicio: true, reposicionFin: true,
  averiado: true, volumenTotalM3: true, pesoTotalKg: true,
} as const

/**
 * GET /api/indicadores-muebles/analitica - tablero de picking + inspección +
 * entrega: completadas, ciudades, PLU, proyección del turno, cuellos de
 * botella, horas pico, calidad y mezcla.
 *
 * Solo lee y delega el cálculo en mueblesAnaliticaCalc (puro). Mismo permiso
 * que el informe de muebles: supervisión del área.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  if (!esGestionMuebles(actor.role)) {
    throw createError({ statusCode: 403, statusMessage: 'La analítica de muebles es para supervisión' })
  }

  const sp = getQuery(event)
  const hoy = diaBogota(new Date())
  let desde = RE_DIA.test(String(sp.desde ?? '')) ? String(sp.desde) : hoy
  let hasta = RE_DIA.test(String(sp.hasta ?? '')) ? String(sp.hasta) : hoy
  if (desde > hasta) [desde, hasta] = [hasta, desde]
  if (hasta > hoy) hasta = hoy
  if (desde > hasta) desde = hasta
  const dias = (new Date(`${hasta}T12:00:00Z`).getTime() - new Date(`${desde}T12:00:00Z`).getTime()) / 86_400_000 + 1
  if (dias > MAX_DIAS) {
    throw createError({ statusCode: 400, statusMessage: `El rango no puede pasar de ${MAX_DIAS} días` })
  }
  const { inicio, fin } = limitesRango(desde, hasta)
  const enRango = { gte: inicio, lte: fin }

  // Plantilla del turno: la real por defecto; la pantalla deja simular otra.
  const gente = (v: unknown, defecto: number) => {
    const n = Number(v)
    return Number.isInteger(n) && n >= 1 && n <= MAX_PLANTILLA_MUEBLES ? n : defecto
  }
  const plantilla = {
    operarios: gente(sp.operarios, PLANTILLA_MUEBLES_DEFECTO.operarios),
    inspectores: gente(sp.inspectores, PLANTILLA_MUEBLES_DEFECTO.inspectores),
  }

  const [ordenes, lineasPeriodo] = await Promise.all([
    // Toda orden que se movió en el rango: empezó, terminó inspección o salió.
    prisma.ordenMuebles.findMany({
      where: {
        deletedAt: null,
        OR: [{ horaInicio: enRango }, { horaFinInspeccion: enRango }, { entregadaTransporteAt: enRango }],
      },
      select: {
        id: true, codigo: true, tipoOrden: true, estado: true,
        horaInicio: true, horaPasoInspeccion: true, horaFinInspeccion: true, entregadaTransporteAt: true,
        ciudadEnvio: true, pausaSegundos: true,
        lineas: { select: SELECT_LINEA },
        _count: { select: { erroresPicking: { where: { deletedAt: null } }, pendientes: true } },
      },
    }),
    // PLU con el picking empezado en el rango: top de PLU, horas pico y personal.
    prisma.lineaMuebles.findMany({
      where: { horaInicio: enRango, orden: { deletedAt: null } },
      select: SELECT_LINEA,
    }),
  ])

  // La inspección se reparte entre los PLU que un inspector tenía abiertos a la
  // vez (ver inspeccionRepartida): sin eso una TSDM de 23 PLU sumaba horas.
  const todas = ordenes.flatMap((o) => o.lineas)
  const repartida = inspeccionRepartida(todas)

  const aLinea = (l: (typeof todas)[number], inspMin: number | null): LineaAnalitica => ({
    ordenId: l.ordenId,
    esPicking: l.operario?.role === ROL_PICKING,
    plu: l.plu,
    descripcion: l.descripcion,
    unidades: l.unidades,
    operarioId: l.operarioId,
    horaInicio: l.horaInicio,
    horaFin: l.horaFin,
    pausaSegundos: l.pausaSegundos ?? 0,
    inspectorId: l.inspectorId,
    inspHoraInicio: l.inspHoraInicio,
    inspHoraFin: l.inspHoraFin,
    inspMin,
    ebanisteriaInicio: l.ebanisteriaInicio,
    averiado: l.averiado,
    volumenTotalM3: l.volumenTotalM3 == null ? null : Number(l.volumenTotalM3),
    pesoTotalKg: l.pesoTotalKg == null ? null : Number(l.pesoTotalKg),
  })

  const entrada: OrdenAnalitica[] = ordenes.map((o) => ({
    id: o.id,
    codigo: o.codigo,
    tipoOrden: o.tipoOrden,
    estado: o.estado,
    horaInicio: o.horaInicio,
    horaPasoInspeccion: o.horaPasoInspeccion,
    horaFinInspeccion: o.horaFinInspeccion,
    entregadaTransporteAt: o.entregadaTransporteAt,
    ciudadEnvio: o.ciudadEnvio,
    pausaSegundos: o.pausaSegundos ?? 0,
    lineas: o.lineas.map((l) => aLinea(l, repartida.get(l) ?? null)),
    errores: o._count.erroresPicking,
    pendientes: o._count.pendientes,
  }))

  return {
    success: true,
    rango: { desde, hasta },
    data: analiticaMuebles({
      ordenes: entrada,
      lineasPeriodo: lineasPeriodo.map((l) => aLinea(l, null)),
      desde,
      hasta,
      plantilla,
    }),
  }
})
