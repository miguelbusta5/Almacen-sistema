import { createError, defineEventHandler, getQuery } from 'h3'
import { requireAuth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { actorInventario, productoInventario } from '../../utils/inventarioCiclico'
export default defineEventHandler(async event => {
  const actor = await requireAuth(event); await actorInventario(actor)
  const q = getQuery(event)
  const t = await prisma.inventarioTarea.findUnique({ where: { id: String(q.tareaId ?? '') }, include: { ciclo: { select: { cronogramaId: true } } } })
  if (!t || t.usuarioId !== actor.id || t.estado !== 'EN_CURSO' || t.pausaInicio) throw createError({ statusCode: 403, statusMessage: 'Inicia o reanuda tu tarea antes de escanear' })
  const p = await productoInventario(prisma, t.ciclo.cronogramaId, String(q.codigo ?? '').trim().toUpperCase())
  if (!p) throw createError({ statusCode: 404, statusMessage: 'Código no encontrado en el PVP; informa a Carlos para actualizarlo' })
  return { plu: p.plu, descripcion: p.descripcion }
})
