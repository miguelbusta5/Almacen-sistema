import { defineOperacionAlmacenHandler } from '../../../utils/operacionAlmacen'
import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { assertPuedeMontar, assertVeMontaje } from '../../../utils/resurtido'

// DELETE /api/montaje-resurtido/:id - borrado logico del montaje entero.
export default defineOperacionAlmacenHandler(async (event) => {
  const actor = await requireAuth(event)
  assertVeMontaje(actor.role)
  await assertPuedeMontar(actor.id)

  const id = getRouterParam(event, 'id')!
  const m = await prisma.montajeResurtido.findUnique({
    where: { id },
    select: { deletedAt: true, nombreArchivo: true },
  })
  if (!m || m.deletedAt) throw createError({ statusCode: 404, statusMessage: 'Montaje no encontrado' })

  await prisma.montajeResurtido.update({ where: { id }, data: { deletedAt: new Date() } })

  await prisma.activityLog.create({
    data: {
      userId: actor.id, action: 'DELETE', module: 'montaje-resurtido',
      recordId: id, details: `Montaje ${m.nombreArchivo} eliminado`,
    },
  }).catch(() => {})

  return { success: true }
})
