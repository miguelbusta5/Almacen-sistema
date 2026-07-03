import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapDespacho } from '../../../utils/mapRow'

// GET /api/tienda/[id]
export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const row = await prisma.despachoTienda.findUnique({
    where: { id },
    include: {
      creadoPor: { select: { id: true, name: true } },
      plines: true,
      guardadoPendiente: { include: { asignadoA: { select: { name: true } } } },
    },
  })
  if (!row) throw createError({ statusCode: 404, statusMessage: 'No encontrado' })

  const logs = await prisma.activityLog.findMany({
    where: { module: 'tienda', recordId: id },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return {
    success: true,
    data: mapDespacho(row),
    historial: logs.map((l) => ({
      action: l.action, details: l.details,
      userName: l.user?.name ?? null, createdAt: l.createdAt.toISOString(),
    })),
  }
})
