import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { ORDEN_INCLUDE, requirePicking } from '../../utils/muebles'
import { esGestionMuebles } from '../../utils/mueblesCalc'
import { mapOrdenMuebles } from '../../utils/mapRow'

/**
 * GET /api/picking-muebles - historico de ordenes.
 *
 * El operario ve solo las suyas; gestion ve las de todos. Es la misma regla que
 * en el resto del proyecto: el operario no necesita ver el trabajo ajeno y sus
 * tiempos no son suyos para mirarlos.
 */
export default defineEventHandler(async (event) => {
  const actor = await requirePicking(event)
  const q = getQuery(event)
  const limit = Math.min(Number(q.limit) || 50, 200)

  const ordenes = await prisma.ordenMuebles.findMany({
    where: {
      deletedAt: null,
      ...(esGestionMuebles(actor.role) ? {} : { operarioId: actor.id }),
      ...(typeof q.estado === 'string' && q.estado ? { estado: q.estado as never } : {}),
    },
    include: ORDEN_INCLUDE,
    orderBy: { horaInicio: 'desc' },
    take: limit,
  })

  return { success: true, data: ordenes.map(mapOrdenMuebles) }
})
