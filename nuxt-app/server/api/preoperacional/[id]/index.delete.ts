import { defineEventHandler, getRouterParam } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireCan } from '../../../utils/auth'

// DELETE /api/preoperacional/[id] — solo ADMIN
export default defineEventHandler(async (event) => {
  const actor = await requireCan(event, 'delete')
  const id = getRouterParam(event, 'id')!
  await prisma.inspeccionPreoperacional.delete({ where: { id } }).catch(() => {})
  await prisma.activityLog.create({
    data: { userId: actor.id, action: 'DELETE', module: 'preoperacional', recordId: id },
  }).catch(() => {})
  return { success: true }
})
