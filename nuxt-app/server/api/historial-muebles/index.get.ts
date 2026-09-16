import { defineEventHandler, getQuery, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { esGestionMuebles, normalizarCiudad, normalizarCodigoOrden } from '../../utils/mueblesCalc'
import { diaBogota, limitesRango } from '../../utils/indicadoresCalc'
import { mapOrdenMuebles } from '../../utils/mapRow'
import { ORDEN_INCLUDE } from '../../utils/muebles'

const RE_DIA = /^\d{4}-\d{2}-\d{2}$/
const ESTADOS = ['EN_PICKING', 'EN_INSPECCION', 'INSPECCIONADA', 'ENTREGADA_TRANSPORTE'] as const

/**
 * GET /api/historial-muebles - todas las ordenes de muebles, para consultar como
 * quedaron sus tiempos.
 *
 * Filtros: rango por inicio del picking, estado, ciudad, operario y codigo. Con
 * codigo se ignora el rango: quien busca una orden concreta no sabe de que dia es.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  if (!esGestionMuebles(actor.role)) {
    throw createError({ statusCode: 403, statusMessage: 'El historial de muebles es para supervisión' })
  }

  const q = getQuery(event)
  const hoy = diaBogota(new Date())
  let desde = RE_DIA.test(String(q.desde ?? '')) ? String(q.desde) : hoy
  let hasta = RE_DIA.test(String(q.hasta ?? '')) ? String(q.hasta) : hoy
  if (desde > hasta) [desde, hasta] = [hasta, desde]
  const codigo = q.codigo ? normalizarCodigoOrden(q.codigo) : ''
  const estado = ESTADOS.find((e) => e === q.estado) ?? null
  const ciudad = q.ciudad ? normalizarCiudad(q.ciudad) : ''
  const operarioId = q.operarioId ? String(q.operarioId) : ''
  const { inicio, fin } = limitesRango(desde, hasta)

  const ordenes = await prisma.ordenMuebles.findMany({
    where: {
      deletedAt: null,
      ...(codigo ? { codigo: { contains: codigo } } : { horaInicio: { gte: inicio, lte: fin } }),
      ...(estado ? { estado } : {}),
      ...(ciudad ? { ciudadEnvio: ciudad } : {}),
      ...(operarioId ? { participantes: { some: { usuarioId: operarioId } } } : {}),
    },
    include: ORDEN_INCLUDE,
    orderBy: { horaInicio: 'desc' },
    take: 300,
  })

  return {
    success: true,
    rango: { desde, hasta },
    data: ordenes.map(mapOrdenMuebles),
    // La pantalla muestra el boton de corregir; el servidor lo vuelve a exigir.
    puedeCorregir: actor.role === 'ADMIN',
  }
})
