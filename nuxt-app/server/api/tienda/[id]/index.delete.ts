import { defineEventHandler, getRouterParam } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireCan } from '../../../utils/auth'

// DELETE /api/tienda/[id] — solo ADMIN
export default defineEventHandler(async (event) => {
  const actor = await requireCan(event, 'delete')
  const id = getRouterParam(event, 'id')!
  await prisma.despachoTienda.delete({ where: { id } })
  await prisma.activityLog.create({
    data: { userId: actor.id, action: 'DELETE', module: 'tienda', recordId: id },
  }).catch(() => {})
  return { success: true }
})
