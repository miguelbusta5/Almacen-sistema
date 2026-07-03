import { defineEventHandler, getRouterParam } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireCan } from '../../../utils/auth'

// DELETE /api/transporte/[clientId] — borra + tombstone permanente (solo ADMIN)
export default defineEventHandler(async (event) => {
  const actor = await requireCan(event, 'delete')
  const clientId = getRouterParam(event, 'clientId')!

  await prisma.transporteGuardado.delete({ where: { client_id: clientId } }).catch(() => {})
  await prisma.transporteDeleted.upsert({
    where: { client_id: clientId },
    update: {},
    create: { client_id: clientId },
  })
  await prisma.activityLog.create({
    data: { userId: actor.id, action: 'DELETE', module: 'transporte', recordId: clientId },
  }).catch(() => {})

  return { success: true }
})
