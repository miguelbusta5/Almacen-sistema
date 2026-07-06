import { defineEventHandler, readBody, getRouterParam, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireRole } from '../../../utils/auth'
import type { EstadoPedidoGourmet } from '../../../utils/gourmetFlow'

const ROLES_PERMITIDOS = ['ADMIN', 'GERENTE']
const ROLES_NOTIFICAR = ['ADMIN', 'GERENTE'] as const

const bodySchema = z.object({ updatedAt: z.string() })

function mapPedido(r: any) {
  return {
    id: r.id, orden: r.orden, tipoOrden: r.tipoOrden, codigoTienda: r.codigoTienda,
    nombreTienda: r.nombreTienda, ciudadDestino: r.ciudadDestino, estado: r.estado,
    updatedAt: r.updatedAt.toISOString(),
    cargueIniciadoAt: r.cargueIniciadoAt ? r.cargueIniciadoAt.toISOString() : null,
    cargueIniciadoPorId: r.cargueIniciadoPorId ?? null,
  }
}

// POST /api/cargue-gourmet/[id]/revertir-cargue
export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, ROLES_PERMITIDOS)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  const d = parsed.data

  const pedido = await prisma.gourmetPedido.findUnique({
    where: { id },
    select: { id: true, orden: true, tipoOrden: true, estado: true, updatedAt: true, ciudadDestino: true, enviadoTransporteAt: true, creadoPorId: true },
  })
  if (!pedido) throw createError({ statusCode: 404, statusMessage: 'No encontrado' })

  // No se reutiliza la máquina de estados genérica: esta es una acción de
  // supervisión excepcional (revertir, no avanzar el flujo normal) y ya está
  // restringida a ADMIN/GERENTE por requireRole.
  if (pedido.estado !== 'EN_CARGUE') {
    throw createError({ statusCode: 409, statusMessage: `No se puede revertir: el pedido está en estado ${pedido.estado}`, data: { code: 'ESTADO_INVALIDO' } })
  }

  // Vuelve al estado predecesor real: si el pedido pasó por
  // ENVIADO_A_TRANSPORTE (flujo heredado), regresa ahí; si no, a
  // UBICACION_ASIGNADA (flujo actual).
  const destino: EstadoPedidoGourmet = pedido.enviadoTransporteAt ? 'ENVIADO_A_TRANSPORTE' : 'UBICACION_ASIGNADA'

  if (new Date(d.updatedAt).getTime() !== pedido.updatedAt.getTime()) {
    throw createError({ statusCode: 409, statusMessage: 'Conflicto: el pedido fue modificado por otro usuario', data: { code: 'CONFLICT' } })
  }

  const cargue = await prisma.gourmetCargue.findFirst({ where: { pedidoId: id, estado: 'EN_CARGUE' } })
  if (!cargue) throw createError({ statusCode: 409, statusMessage: 'No hay un cargue activo para revertir' })

  const pedidoActualizado = await prisma.$transaction(async (tx) => {
    // Cascada automática sobre escaneos/novedades del cargue (onDelete: Cascade).
    await tx.gourmetCargue.delete({ where: { id: cargue.id } })
    return tx.gourmetPedido.update({ where: { id }, data: { estado: destino, cargueIniciadoAt: null, cargueIniciadoPorId: null } })
  })

  const destinatariosIds = new Set<string>()
  if (pedido.creadoPorId) destinatariosIds.add(pedido.creadoPorId)
  const adminsGerentes = await prisma.user.findMany({ where: { active: true, role: { in: [...ROLES_NOTIFICAR] } }, select: { id: true } })
  adminsGerentes.forEach((u) => destinatariosIds.add(u.id))

  if (destinatariosIds.size > 0) {
    await prisma.notificacion.createMany({
      data: Array.from(destinatariosIds).map((userId) => ({
        userId, titulo: 'Cargue Gourmet revertido',
        descripcion: `${pedidoActualizado.tipoOrden} ${pedidoActualizado.orden} — destino ${pedidoActualizado.ciudadDestino}`,
        tipo: 'CARGUE_GOURMET', enlace: '/dashboard/cargue-gourmet',
      })),
    }).catch(() => {})
  }

  await prisma.activityLog.create({
    data: { userId: actor.id, action: 'UPDATE', module: 'cargue-gourmet', recordId: pedido.id, details: `Cargue revertido — ${pedido.tipoOrden} ${pedido.orden} vuelve a ${destino}` },
  }).catch(() => {})

  return { success: true, data: { pedido: mapPedido(pedidoActualizado) } }
})
