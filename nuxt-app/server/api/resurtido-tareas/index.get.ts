import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { mapMontaje } from '../../utils/mapRow'
import { assertEjecutor, MONTAJE_INCLUDE } from '../../utils/resurtido'

/**
 * GET /api/resurtido-tareas - lo que el operario TIENE QUE HACER.
 *
 * No lo que ya hizo: su pantalla es una lista de trabajo, no un historico. Las
 * tareas vienen ordenadas por posicion desde el montaje.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertEjecutor(actor.role)

  const rows = await prisma.montajeResurtido.findMany({
    where: { operarioId: actor.id, estado: 'EN_CURSO', deletedAt: null },
    include: MONTAJE_INCLUDE,
    orderBy: { montadoAt: 'asc' },
  })

  return { success: true, data: rows.map(mapMontaje) }
})
