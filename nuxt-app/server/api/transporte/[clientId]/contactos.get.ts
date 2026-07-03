import { defineEventHandler, getRouterParam } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const clientId = getRouterParam(event, 'clientId')!

  const rows = await prisma.contactoGuardado.findMany({
    where: { guardadoClientId: clientId },
    include: { registradoPorUser: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return {
    success: true,
    data: rows.map((r: any) => ({
      id: r.id, guardadoClientId: r.guardadoClientId,
      tipo: r.tipo, resultado: r.resultado,
      fechaCompromiso: r.fechaCompromiso ? r.fechaCompromiso.toISOString().slice(0, 10) : null,
      nota: r.nota,
      registradoPor: r.registradoPor,
      registradoPorNombre: r.registradoPorUser?.name ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  }
})
