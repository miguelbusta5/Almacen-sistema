import { defineEventHandler, getRouterParam } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireCan } from '../../../utils/auth'

// DELETE /api/integracion/[id] — solo ADMIN
export default defineEventHandler(async (event) => {
  const actor = await requireCan(event, 'delete')
  const id = getRouterParam(event, 'id')!
  await prisma.integracionPedido.delete({ where: { id } }).catch(() => {})
  await prisma.activityLog.create({
    data: { userId: actor.id, action: 'DELETE', module: 'integracion', recordId: id },
  }).catch(() => {})
  return { success: true }
})
