import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { canSeeIntegracion } from '../../../utils/integracion'
import { mapIntegracion } from '../../../utils/mapRow'

// GET /api/integracion/[id]
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  if (!canSeeIntegracion(actor.role)) throw createError({ statusCode: 403, statusMessage: 'Sin acceso' })

  const id = getRouterParam(event, 'id')!
  const rec = await prisma.integracionPedido.findUnique({
    where: { id },
    include: {
      creadoPor: { select: { name: true } },
      completadoPor: { select: { name: true } },
      plines: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!rec) throw createError({ statusCode: 404, statusMessage: 'No encontrado' })

  return { success: true, data: mapIntegracion(rec) }
})
