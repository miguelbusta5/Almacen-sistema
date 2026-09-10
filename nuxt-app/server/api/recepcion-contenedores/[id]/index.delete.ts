import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { assertGestorRecepcion, assertUsuarioRecepcion } from '../../../utils/recepcion'

// DELETE /api/recepcion-contenedores/:id - borrado logico, solo supervision.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioRecepcion(actor.role)
  assertGestorRecepcion(actor.role, 'Solo supervision puede borrar una recepcion')

  const id = getRouterParam(event, 'id')!
  const record = await prisma.recepcionContenedor.findUnique({
    where: { id },
    select: { deletedAt: true, numeroPedido: true },
  })
  if (!record || record.deletedAt) {
    throw createError({ statusCode: 404, statusMessage: 'Recepcion no encontrada' })
  }

  await prisma.recepcionContenedor.update({
    where: { id },
    data: { deletedAt: new Date(), actualizadoPorId: actor.id },
  })

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: 'DELETE',
      module: 'recepcion-contenedores',
      recordId: id,
      details: `Recepcion ${record.numeroPedido} eliminada`,
    },
  }).catch(() => {})

  return { success: true }
})
