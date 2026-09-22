import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { actorInventario } from '../../utils/inventarioCiclico'
export default defineEventHandler(async event => {
  await actorInventario(await requireAuth(event), true)
  const permisos = await prisma.inventarioAcceso.findMany({ where: { contar: true }, select: { userId: true } })
  return prisma.user.findMany({ where: { id: { in: permisos.map(p => p.userId) }, active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
})
