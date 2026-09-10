import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { mapMontaje } from '../../utils/mapRow'
import { assertVeMontaje, MONTAJE_INCLUDE } from '../../utils/resurtido'

// GET /api/montaje-resurtido - los resurtidos montados, mas recientes primero.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertVeMontaje(actor.role)

  const sp = getQuery(event)
  const soloAbiertos = String(sp.estado ?? '') === 'en-curso'

  const rows = await prisma.montajeResurtido.findMany({
    where: {
      deletedAt: null,
      ...(soloAbiertos && { estado: 'EN_CURSO' as const }),
    },
    include: MONTAJE_INCLUDE,
    orderBy: { montadoAt: 'desc' },
    take: 60,
  })

  return { success: true, data: rows.map(mapMontaje) }
})
