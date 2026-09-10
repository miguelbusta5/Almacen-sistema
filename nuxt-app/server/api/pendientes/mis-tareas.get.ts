import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { mapPendiente } from '../../utils/mapRow'
import { assertEjecutor, PENDIENTE_INCLUDE } from '../../utils/resurtido'

// GET /api/pendientes/mis-tareas - los pendientes que le tocan al operario.
// Aparecen en su pestana de Resurtido, no en el modulo de Pendientes: el
// operario no solicita ni reparte, solo ejecuta.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertEjecutor(actor.role)

  const rows = await prisma.pendienteGourmet.findMany({
    where: {
      operarioId: actor.id,
      estado: { in: ['ASIGNADO', 'EN_CURSO'] },
      deletedAt: null,
    },
    include: PENDIENTE_INCLUDE,
    orderBy: { asignadoAt: 'asc' },
  })

  return { success: true, data: rows.map(mapPendiente) }
})
