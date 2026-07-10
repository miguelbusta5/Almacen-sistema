import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../../../utils/prisma'
import { requireRole } from '../../../../../utils/auth'
import { mapPedidoGourmetDetalle } from '../../../../../utils/mapRow'

// Resolver una novedad abierta desbloquea "Finalizar" en ese cargue (el
// endpoint de finalizar rechaza mientras exista alguna novedad ABIERTA,
// sin importar que el conteo de cajas ya coincida). Originalmente solo
// ADMIN; TRANSPORTE se agregó a pedido explícito del usuario para que el
// operario en cargue pueda destrabar sus novedades y finalizar sin
// depender del administrador. Deliberadamente NO se extendió al resto de
// roles del ciclo de cargue.
const ROLES_PERMITIDOS = ['TRANSPORTE', 'ADMIN']

// POST /api/cargue-gourmet/[id]/novedades/[novedadId]/resolver
export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, ROLES_PERMITIDOS)
  const id = getRouterParam(event, 'id')!
  const novedadId = getRouterParam(event, 'novedadId')!

  const novedad = await prisma.gourmetCargueNovedad.findUnique({
    where: { id: novedadId },
    select: { id: true, pedidoId: true, estado: true, tipo: true },
  })
  if (!novedad || novedad.pedidoId !== id) throw createError({ statusCode: 404, statusMessage: 'Novedad no encontrada en este pedido' })
  if (novedad.estado !== 'ABIERTA') throw createError({ statusCode: 409, statusMessage: 'Esta novedad ya fue resuelta', data: { code: 'YA_RESUELTA' } })

  await prisma.gourmetCargueNovedad.update({
    where: { id: novedadId },
    data: { estado: 'RESUELTA', resueltaPorId: actor.id, resueltaAt: new Date() },
  })

  const row = await prisma.gourmetPedido.findUniqueOrThrow({
    where: { id },
    include: {
      creadoPor: { select: { name: true } },
      estibas: { orderBy: { secuencia: 'asc' } },
      cajas: { orderBy: [{ numeroSecuencia: 'asc' }, { createdAt: 'asc' }] },
      cargues: { orderBy: { iniciadoAt: 'desc' }, include: { escaneos: { orderBy: { createdAt: 'desc' }, take: 50 } } },
      novedades: { orderBy: { createdAt: 'desc' } },
    },
  })

  const actorIds = new Set<string>()
  for (const c of row.cargues) {
    actorIds.add(c.iniciadoPorId)
    if (c.finalizadoPorId) actorIds.add(c.finalizadoPorId)
    for (const e of c.escaneos) actorIds.add(e.escaneadoPorId)
  }
  for (const n of row.novedades) {
    actorIds.add(n.registradaPorId)
    if (n.resueltaPorId) actorIds.add(n.resueltaPorId)
  }
  const actores = actorIds.size > 0
    ? await prisma.user.findMany({ where: { id: { in: [...actorIds] } }, select: { id: true, name: true } })
    : []
  const nombrePorId = new Map(actores.map((u) => [u.id, u.name]))

  await prisma.activityLog.create({
    data: { userId: actor.id, action: 'UPDATE', module: 'cargue-gourmet', recordId: id, details: `Novedad resuelta — ${novedad.tipo}` },
  }).catch(() => {})

  return { success: true, data: mapPedidoGourmetDetalle(row, nombrePorId) }
})
