import { defineEventHandler, getQuery, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { esGestionMuebles } from '../../utils/mueblesCalc'
import { agregarIndicadoresMuebles, resumirErroresPicking } from '../../utils/mueblesIndicadoresCalc'
import { diaBogota, limitesRango } from '../../utils/indicadoresCalc'

const RE_DIA = /^\d{4}-\d{2}-\d{2}$/

/**
 * GET /api/indicadores-muebles - el informe del area.
 *
 * Solo junta filas y delega el calculo en mueblesIndicadoresCalc, que es puro y
 * se testea sin base de datos. Mismo reparto de responsabilidades que
 * /api/indicadores.
 *
 * Endpoint aparte del de montacargas y no una pestaña suya: aquel esta cerrado a
 * MONTACARGAS/OPERARIO_ALMACENAMIENTO y gira sobre un `TipoTarea` de cinco
 * valores triplicado y vigilado por tests. Meter muebles ahi obligaria a tocar
 * todo eso.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  if (!esGestionMuebles(actor.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Los indicadores de muebles son para supervision' })
  }

  const sp = getQuery(event)
  const hoy = diaBogota(new Date())
  let desde = RE_DIA.test(String(sp.desde ?? '')) ? String(sp.desde) : hoy
  let hasta = RE_DIA.test(String(sp.hasta ?? '')) ? String(sp.hasta) : hoy
  if (desde > hasta) [desde, hasta] = [hasta, desde]
  const operarioId = sp.operarioId ? String(sp.operarioId) : null

  const { inicio, fin } = limitesRango(desde, hasta)

  // El rango se filtra por el inicio del PICKING del PLU, que es cuando empieza
  // el trabajo. Filtrar por el fin dejaria fuera lo que sigue abierto, que es
  // justo lo que interesa ver de un dia en curso.
  const [lineas, ordenes, operarios, inspectores, errores] = await Promise.all([
    prisma.lineaMuebles.findMany({
      where: {
        horaInicio: { gte: inicio, lte: fin },
        orden: { deletedAt: null },
        ...(operarioId ? { operarioId } : {}),
      },
      select: {
        plu: true, descripcion: true, operarioId: true, ordenId: true,
        horaInicio: true, horaFin: true,
        volumenTotalM3: true, pesoTotalKg: true,
        inspectorId: true, inspHoraInicio: true, inspHoraFin: true,
        ebanisteriaInicio: true, ebanisteriaFin: true, motivoEbanisteria: true,
        estado: true, pausaSegundos: true, inspPausaSegundos: true,
        reposicionInicio: true, reposicionFin: true,
      },
    }),
    prisma.ordenMuebles.findMany({
      where: { horaInicio: { gte: inicio, lte: fin }, deletedAt: null },
      select: { id: true, codigo: true, horaInicio: true, horaPasoInspeccion: true, horaFinInspeccion: true, pausaSegundos: true, inspPausaSegundos: true,
        entregadaTransporteAt: true, ciudadEnvio: true },
      orderBy: { horaInicio: 'desc' },
    }),
    prisma.user.findMany({
      where: { role: 'PICKING_MUEBLES' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.inspector.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } }),
    // Errores de picking de los PLU del periodo (mismo corte: inicio del picking).
    prisma.errorPickingMuebles.findMany({
      where: {
        deletedAt: null,
        orden: { deletedAt: null },
        linea: { horaInicio: { gte: inicio, lte: fin } },
        ...(operarioId ? { operarioId } : {}),
      },
      select: {
        ordenId: true, plu: true, tipo: true, nota: true, createdAt: true, operarioId: true,
        orden: { select: { codigo: true } },
        linea: { select: { descripcion: true } },
        operario: { select: { name: true } },
        marcadoPor: { select: { name: true } },
      },
    }),
  ])

  const erroresPicking = resumirErroresPicking(
    errores.map((e) => ({
      ordenId: e.ordenId, codigoOrden: e.orden.codigo, plu: e.plu,
      descripcion: e.linea?.descripcion ?? null,
      operarioId: e.operarioId, operarioNombre: e.operario.name,
      tipo: e.tipo, nota: e.nota ?? null,
      marcadoPorNombre: e.marcadoPor.name, fecha: e.createdAt,
    })),
    lineas,
    ordenes.length,
  )

  return {
    success: true,
    rango: { desde, hasta },
    equipo: operarios.map((o) => ({ id: o.id, nombre: o.name })),
    erroresPicking,
    data: agregarIndicadoresMuebles({
      lineas: lineas.map((l) => ({
        ...l,
        volumenTotalM3: l.volumenTotalM3 == null ? null : Number(l.volumenTotalM3),
        pesoTotalKg: l.pesoTotalKg == null ? null : Number(l.pesoTotalKg),
      })),
      ordenes,
      operarios: operarios.map((o) => ({ id: o.id, nombre: o.name })),
      inspectores,
    }),
  }
})
