import { defineEventHandler, readBody, getRouterParam, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireRole } from '../../../utils/auth'
import { assertTransicionGourmet, type EstadoPedidoGourmet } from '../../../utils/gourmetFlow'

const ROLES_PERMITIDOS = ['TRANSPORTE', 'SUPERVISOR_TRANSPORTE', 'OPERACIONES_GOURMET', 'ADMIN', 'GERENTE']
const ROLES_NOTIFICAR = ['ADMIN', 'GERENTE'] as const

const bodySchema = z.object({ updatedAt: z.string() })

function mapPedido(r: any) {
  return {
    id: r.id, orden: r.orden, tipoOrden: r.tipoOrden, codigoTienda: r.codigoTienda,
    nombreTienda: r.nombreTienda, ciudadDestino: r.ciudadDestino, estado: r.estado,
    updatedAt: r.updatedAt.toISOString(),
    cargueCompletadoAt: r.cargueCompletadoAt ? r.cargueCompletadoAt.toISOString() : null,
    cargueCompletadoPorId: r.cargueCompletadoPorId ?? null,
  }
}

function mapCargue(c: any) {
  return {
    id: c.id, pedidoId: c.pedidoId, estado: c.estado, tipoCierre: c.tipoCierre,
    cantidadEsperada: c.cantidadEsperada, cantidadEscaneada: c.cantidadEscaneada,
    finalizadoAt: c.finalizadoAt ? c.finalizadoAt.toISOString() : null,
    finalizadoPorId: c.finalizadoPorId ?? null,
  }
}

// POST /api/cargue-gourmet/[id]/finalizar
export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, ROLES_PERMITIDOS)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  const d = parsed.data

  const pedido = await prisma.gourmetPedido.findUnique({
    where: { id },
    select: { id: true, orden: true, estado: true, updatedAt: true, ciudadDestino: true, creadoPorId: true },
  })
  if (!pedido) throw createError({ statusCode: 404, statusMessage: 'No encontrado' })

  const destino: EstadoPedidoGourmet = 'CARGUE_COMPLETO'
  const origen = pedido.estado as EstadoPedidoGourmet
  const check = assertTransicionGourmet(origen, destino, actor.role)
  if (!check.ok) {
    throw createError({ statusCode: check.motivo === 'SIN_PERMISO' ? 403 : 409, statusMessage: check.mensaje, data: { code: check.motivo } })
  }

  const cargue = await prisma.gourmetCargue.findFirst({ where: { pedidoId: id, estado: 'EN_CARGUE' } })
  if (!cargue) throw createError({ statusCode: 409, statusMessage: 'No hay un cargue activo para este pedido' })

  if (new Date(d.updatedAt).getTime() !== pedido.updatedAt.getTime()) {
    throw createError({ statusCode: 409, statusMessage: 'Conflicto: el pedido fue modificado por otro usuario', data: { code: 'CONFLICT' } })
  }

  if (cargue.cantidadEscaneada !== cargue.cantidadEsperada) {
    throw createError({
      statusCode: 409,
      statusMessage: `Cajas escaneadas (${cargue.cantidadEscaneada}) no coinciden con las esperadas (${cargue.cantidadEsperada})`,
      data: { code: 'CANTIDAD_NO_COINCIDE' },
    })
  }

  const novedadAbierta = await prisma.gourmetCargueNovedad.findFirst({ where: { cargueId: cargue.id, estado: 'ABIERTA' }, select: { id: true } })
  if (novedadAbierta) {
    throw createError({ statusCode: 409, statusMessage: 'Hay novedades abiertas — resuélvelas antes de finalizar el cargue', data: { code: 'NOVEDAD_ABIERTA' } })
  }

  const { pedido: pedidoActualizado, cargue: cargueActualizado } = await prisma.$transaction(async (tx) => {
    const cargueFinal = await tx.gourmetCargue.update({
      where: { id: cargue.id },
      data: { estado: 'CARGUE_COMPLETO', finalizadoAt: new Date(), finalizadoPorId: actor.id, tipoCierre: 'NORMAL' },
    })
    const pedidoFinal = await tx.gourmetPedido.update({
      where: { id },
      data: { estado: 'CARGUE_COMPLETO', cargueCompletadoAt: new Date(), cargueCompletadoPorId: actor.id },
    })
    return { pedido: pedidoFinal, cargue: cargueFinal }
  })

  const destinatariosIds = new Set<string>()
  if (pedido.creadoPorId) destinatariosIds.add(pedido.creadoPorId)
  const adminsGerentes = await prisma.user.findMany({ where: { active: true, role: { in: [...ROLES_NOTIFICAR] } }, select: { id: true } })
  adminsGerentes.forEach((u) => destinatariosIds.add(u.id))

  if (destinatariosIds.size > 0) {
    await prisma.notificacion.createMany({
      data: Array.from(destinatariosIds).map((userId) => ({
        userId, titulo: 'Cargue Gourmet finalizado',
        descripcion: `${pedidoActualizado.orden} — destino ${pedidoActualizado.ciudadDestino}`,
        tipo: 'CARGUE_GOURMET', enlace: '/dashboard/cargue-gourmet',
      })),
    }).catch(() => {})
  }

  return { success: true, data: { pedido: mapPedido(pedidoActualizado), cargue: mapCargue(cargueActualizado) } }
})
