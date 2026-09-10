import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { mapMontaje, mapPendiente } from '../../utils/mapRow'
import { assertEjecutor, MONTAJE_INCLUDE, PENDIENTE_INCLUDE } from '../../utils/resurtido'

/**
 * GET /api/resurtido-tareas - lo que el operario TIENE QUE HACER.
 *
 * Con los pendientes delante: un pendiente es alguien esperando en la tienda, y
 * va antes que el resurtido de rutina. Los que se sumaron a una tarea no salen
 * sueltos, van dentro de esa tarea.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertEjecutor(actor.role)

  const [montajes, pendientes] = await Promise.all([
    prisma.montajeResurtido.findMany({
      where: { operarioId: actor.id, estado: 'EN_CURSO', deletedAt: null },
      include: MONTAJE_INCLUDE,
      orderBy: { montadoAt: 'asc' },
    }),
    prisma.pendienteGourmet.findMany({
      where: {
        operarioId: actor.id,
        estado: { in: ['ASIGNADO', 'EN_CURSO'] },
        tareaResurtidoId: null,
        deletedAt: null,
      },
      include: PENDIENTE_INCLUDE,
      orderBy: { asignadoAt: 'asc' },
    }),
  ])

  return {
    success: true,
    data: montajes.map(mapMontaje),
    prioritarios: pendientes.map(mapPendiente),
  }
})
