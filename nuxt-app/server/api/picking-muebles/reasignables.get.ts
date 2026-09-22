import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { requirePicking } from '../../utils/muebles'
export default defineEventHandler(async event => {
  const actor = await requirePicking(event)
  return prisma.user.findMany({ where: { role: 'PICKING_MUEBLES', active: true, id: { not: actor.id } }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
})
