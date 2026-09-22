import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { actorStretch } from '../../utils/stretch'
export default defineEventHandler(async event => {
  const { actor, permiso } = await actorStretch(event)
  const pedidos = await prisma.stretchPedido.findMany({ where: permiso.gestionar ? {} : { usuarioId: actor.id }, orderBy: { createdAt: 'desc' }, take: 300 })
  if (!permiso.gestionar) return { permiso, pedidos, stock: null, movimientos: [], sesiones: [] }
  const [stock, movimientos, sesiones] = await Promise.all([
    prisma.stretchStock.findUnique({ where: { id: 'principal' } }),
    prisma.stretchMovimiento.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.stretchSesion.findMany({ where: { revocadaAt: null, expiraAt: { gt: new Date() } }, select: { id: true, nombre: true, expiraAt: true, activada: true }, orderBy: { createdAt: 'desc' } }),
  ])
  const ids = [...new Set([...movimientos.map(m => m.usuarioId), ...pedidos.map(p => p.procesadoPorId).filter((id): id is string => !!id)])]
  const personas = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
  return { permiso, pedidos, stock: stock?.rollos ?? 0, movimientos, sesiones, personas }
})
