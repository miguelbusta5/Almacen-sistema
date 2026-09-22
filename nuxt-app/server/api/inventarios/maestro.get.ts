import { createError, defineEventHandler, getQuery } from 'h3'
import { requireAuth } from '../../utils/auth'
import { exigirInventarios } from '../../utils/inventarios'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async event => {
  await exigirInventarios(await requireAuth(event))
  const q = getQuery(event)
  if (typeof q.versionId !== 'string' || !q.versionId) throw createError({ statusCode: 400, statusMessage: 'Selecciona una versión del maestro' })
  const buscar = typeof q.buscar === 'string' ? q.buscar.trim().slice(0, 100) : ''
  const where = { versionId: q.versionId, ...(buscar ? { OR: ['plu', 'upc', 'descripcion'].map(campo => ({ [campo]: { contains: buscar, mode: 'insensitive' as const } })) } : {}) }
  const [total, productos] = await Promise.all([
    prisma.inventarioProductoPvp.count({ where }),
    prisma.inventarioProductoPvp.findMany({ where, take: 50, orderBy: { plu: 'asc' } }),
  ])
  return { total, productos }
})
