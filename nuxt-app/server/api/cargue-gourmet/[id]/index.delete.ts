import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireRole } from '../../../utils/auth'

const ROLES_ELIMINAN = ['ADMIN', 'GERENTE']

// DELETE /api/cargue-gourmet/[id]
export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, ROLES_ELIMINAN)
  const id = getRouterParam(event, 'id')!

  const pedido = await prisma.gourmetPedido.findUnique({
    where: { id },
    select: { estado: true, orden: true, tipoOrden: true },
  })
  if (!pedido) throw createError({ statusCode: 404, statusMessage: 'No encontrado' })

  if (pedido.estado === 'EN_CARGUE') {
    throw createError({
      statusCode: 409,
      statusMessage: 'No se puede eliminar un pedido con cargue en curso. Revierte el cargue primero.',
      data: { code: 'CARGUE_EN_CURSO' },
    })
  }

  // Las relaciones (estibas, cajas, cargues → escaneos/novedades) tienen
  // onDelete: Cascade en el schema — no requieren borrado manual.
  await prisma.gourmetPedido.delete({ where: { id } })

  await prisma.activityLog.create({
    data: { userId: actor.id, action: 'DELETE', module: 'cargue-gourmet', recordId: id, details: `Pedido eliminado — ${pedido.tipoOrden} ${pedido.orden}` },
  }).catch(() => {})

  return { success: true }
})
