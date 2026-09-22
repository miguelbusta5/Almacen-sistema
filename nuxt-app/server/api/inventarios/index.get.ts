import { defineEventHandler } from 'h3'
import { requireAuth } from '../../utils/auth'
import { exigirInventarios } from '../../utils/inventarios'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async event => {
  await exigirInventarios(await requireAuth(event))
  return prisma.inventarioCronograma.findMany({
    orderBy: { createdAt: 'desc' }, take: 100,
    include: { versiones: { orderBy: { numero: 'desc' }, select: { id: true, numero: true, archivo: true, total: true, resumen: true, autorNombre: true, createdAt: true } } },
  })
})
