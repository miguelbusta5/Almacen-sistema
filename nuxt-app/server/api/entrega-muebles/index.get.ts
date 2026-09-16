import { defineEventHandler, getQuery, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { ORDEN_INCLUDE } from '../../utils/muebles'
import { normalizarCiudad, puedeEntregarTransporte } from '../../utils/mueblesCalc'
import { mapOrdenMuebles } from '../../utils/mapRow'

/**
 * GET /api/entrega-muebles - bandeja del Patinador Muebles.
 *
 * Solo ordenes con TODOS los PLU listos (estado INSPECCIONADA): eso es lo que
 * significa "lista para entregar a transporte". Con `historico=1` trae las que
 * ya salieron, para consultar.
 *
 * Devuelve tambien las ciudades con ordenes esperando, que es por donde el
 * patinador agrupa el viaje.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  if (!puedeEntregarTransporte(actor.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Sin acceso a la entrega a transporte' })
  }
  const q = getQuery(event)
  const historico = String(q.historico ?? '') === '1'
  const ciudad = q.ciudad ? normalizarCiudad(q.ciudad) : ''

  const ordenes = await prisma.ordenMuebles.findMany({
    where: {
      deletedAt: null,
      estado: historico ? 'ENTREGADA_TRANSPORTE' : 'INSPECCIONADA',
      ...(ciudad ? { ciudadEnvio: ciudad } : {}),
    },
    include: ORDEN_INCLUDE,
    orderBy: historico ? { entregadaTransporteAt: 'desc' } : { horaFinInspeccion: 'asc' },
    take: historico ? 100 : 200,
  })

  // Las ciudades salen de lo que hay esperando, no de un catalogo: asi la lista
  // nunca muestra una ciudad sin ordenes.
  const esperando = await prisma.ordenMuebles.groupBy({
    by: ['ciudadEnvio'],
    where: { deletedAt: null, estado: 'INSPECCIONADA' },
    _count: { _all: true },
  })

  return {
    success: true,
    data: ordenes.map(mapOrdenMuebles),
    ciudades: esperando
      .map((c) => ({ ciudad: c.ciudadEnvio ?? 'SIN CIUDAD', ordenes: c._count._all }))
      .sort((a, b) => a.ciudad.localeCompare(b.ciudad)),
  }
})
