import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireRole } from '../../../utils/auth'
import { mapPedidoGourmetDetalle } from '../../../utils/mapRow'

const ROLES_VEN = ['ADMIN', 'GERENTE', 'OPERACIONES_GOURMET', 'TRANSPORTE', 'SUPERVISOR_TRANSPORTE']

// GET /api/cargue-gourmet/[id]
export default defineEventHandler(async (event) => {
  await requireRole(event, ROLES_VEN)
  const id = getRouterParam(event, 'id')!

  const row = await prisma.gourmetPedido.findUnique({
    where: { id },
    include: {
      creadoPor: { select: { name: true } },
      estibas: { orderBy: { secuencia: 'asc' } },
      cajas: { orderBy: [{ numeroSecuencia: 'asc' }, { createdAt: 'asc' }] },
      // take: 50 — el historial de escaneos crecía sin límite y abrir un
      // pedido con muchos escaneos bloqueaba el panel con un payload
      // pesado. El panel muestra los recientes (y el escaneo en vivo se
      // parchea localmente en el cliente); el historial completo sigue en
      // la base de datos, no se borra nada.
      cargues: { orderBy: { iniciadoAt: 'desc' }, include: { escaneos: { orderBy: { createdAt: 'desc' }, take: 50 } } },
      novedades: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!row) throw createError({ statusCode: 404, statusMessage: 'No encontrado' })

  // `iniciadoPorId`/`finalizadoPorId` (cargues), `escaneadoPorId` (escaneos) y
  // `registradaPorId`/`resueltaPorId` (novedades) son columnas planas sin
  // relación de Prisma a User — se resuelven a nombre con un solo findMany.
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

  return { success: true, data: mapPedidoGourmetDetalle(row, nombrePorId) }
})
