import { defineEventHandler, getQuery } from 'h3'
import { requireAuth } from '../../utils/auth'
import { exigirTeorico, previewPicking } from '../../utils/picking'
import { prisma } from '../../utils/prisma'
export default defineEventHandler(async event => {
  await exigirTeorico(await requireAuth(event))
  const id = getQuery(event).id
  if (typeof id === 'string') return prisma.$transaction(tx => previewPicking(tx, id))
  return { cargas: await prisma.pickingTeorico.findMany({ orderBy: { creadoAt: 'desc' }, take: 50, select: { id: true, nombre: true, creadoAt: true, montajeId: true } }) }
})
