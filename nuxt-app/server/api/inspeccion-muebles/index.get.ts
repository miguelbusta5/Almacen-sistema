import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { ORDEN_INCLUDE, requireInspeccion } from '../../utils/muebles'
import { mapOrdenMuebles } from '../../utils/mapRow'

/**
 * GET /api/inspeccion-muebles - las ordenes que esperan inspeccion, en vinetas.
 *
 * Devuelve SIEMPRE de quien es cada orden (el inspector del catalogo que se la
 * asigno): es un login compartido entre ~5 personas y lo unico que evita que dos
 * inspectores trabajen la misma orden es verlo en la vineta.
 */
export default defineEventHandler(async (event) => {
  await requireInspeccion(event)
  const q = getQuery(event)
  const incluirCerradas = q.historico === '1'

  const ordenes = await prisma.ordenMuebles.findMany({
    where: {
      deletedAt: null,
      estado: incluirCerradas ? { in: ['EN_INSPECCION', 'INSPECCIONADA'] } : 'EN_INSPECCION',
    },
    include: ORDEN_INCLUDE,
    orderBy: { horaPasoInspeccion: 'asc' },
    take: incluirCerradas ? 100 : 200,
  })

  return { success: true, data: ordenes.map(mapOrdenMuebles) }
})
