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

  // Todas las comprobaciones de negocio (transición válida, conflicto de
  // edición, conteo correcto, sin novedades abiertas) y la escritura van
  // juntas dentro de la misma transacción, con el cargue bloqueado (FOR
  // UPDATE) — así un escaneo concurrente no puede colar una novedad o
  // incrementar el conteo justo después de que estas comprobaciones ya
  // pasaron, dejando un cargue "finalizado" que en realidad las violaba.
  const { pedido: pedidoActualizado, cargue: cargueActualizado } = await prisma.$transaction(async (tx) => {
    const cargue = await tx.gourmetCargue.findFirst({ where: { pedidoId: id, estado: 'EN_CARGUE' } })
    if (!cargue) throw createError({ statusCode: 409, statusMessage: 'No hay un cargue activo para este pedido' })

    await tx.$queryRaw`SELECT id FROM gourmet_cargues WHERE id = ${cargue.id} FOR UPDATE`

    const pedidoActual = await tx.gourmetPedido.findUniqueOrThrow({ where: { id }, select: { estado: true, updatedAt: true } })
    const destino: EstadoPedidoGourmet = 'CARGUE_COMPLETO'
    const origen = pedidoActual.estado as EstadoPedidoGourmet
    const check = assertTransicionGourmet(origen, destino, actor.role)
    if (!check.ok) {
      throw createError({ statusCode: check.motivo === 'SIN_PERMISO' ? 403 : 409, statusMessage: check.mensaje, data: { code: check.motivo } })
    }
    if (new Date(d.updatedAt).getTime() !== pedidoActual.updatedAt.getTime()) {
      throw createError({ statusCode: 409, statusMessage: 'Conflicto: el pedido fue modificado por otro usuario', data: { code: 'CONFLICT' } })
    }

    // Releer el cargue ya bloqueado — su cantidadEscaneada pudo cambiar
    // entre el findFirst de arriba y adquirir el lock.
    const cargueLocked = await tx.gourmetCargue.findUniqueOrThrow({ where: { id: cargue.id } })
    if (cargueLocked.cantidadEscaneada !== cargueLocked.cantidadEsperada) {
      throw createError({
        statusCode: 409,
        statusMessage: `Cajas escaneadas (${cargueLocked.cantidadEscaneada}) no coinciden con las esperadas (${cargueLocked.cantidadEsperada})`,
        data: { code: 'CANTIDAD_NO_COINCIDE' },
      })
    }

    const novedadAbierta = await tx.gourmetCargueNovedad.findFirst({ where: { cargueId: cargue.id, estado: 'ABIERTA' }, select: { id: true } })
    if (novedadAbierta) {
      throw createError({ statusCode: 409, statusMessage: 'Hay novedades abiertas — resuélvelas antes de finalizar el cargue', data: { code: 'NOVEDAD_ABIERTA' } })
    }

    // Pedidos SIN cajas registradas en la creación (modo escaneo libre):
    // las cajas escaneadas en este cargue se convierten automáticamente en
    // las cajas asignadas del pedido al enviarlo — sin ningún paso extra
    // del operario. `estibaId` queda null a propósito (el campo es
    // nullable para este caso).
    const cajasRegistradas = await tx.gourmetPedidoCaja.count({ where: { pedidoId: id } })
    if (cajasRegistradas === 0) {
      const escaneosValidos = await tx.gourmetCargueEscaneo.findMany({
        where: { cargueId: cargue.id, resultado: 'VALIDO' },
        orderBy: { createdAt: 'asc' },
        select: { codigoEscaneado: true },
      })
      if (escaneosValidos.length > 0) {
        await tx.gourmetPedidoCaja.createMany({
          data: escaneosValidos.map((e, i) => ({
            pedidoId: id, codigoCaja: e.codigoEscaneado, numeroSecuencia: i + 1, generadaPorEscaneo: true,
          })),
        })
      }
    }

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
