import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { mapEstiba } from '../../utils/mapRow'
import { assertUsuarioEstibas, ESTIBA_INCLUDE } from '../../utils/estibas'

// GET /api/estibas/abierta — la estiba en curso del actor.
// Endpoint aparte y no derivado de la lista a propósito: el paso "asignar
// ubicación" tiene que sobrevivir a filtros, paginación y a recargar la página.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioEstibas(actor.role)

  const row = await prisma.estiba.findFirst({
    where: { creadoPorId: actor.id, horaFinalizacion: null, deletedAt: null },
    include: ESTIBA_INCLUDE,
    orderBy: [{ horaInicio: 'desc' }],
  })

  return { success: true, data: row ? mapEstiba(row) : null }
})
