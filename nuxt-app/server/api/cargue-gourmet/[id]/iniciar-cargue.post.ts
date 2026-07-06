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
    nombreTienda: r.nombreTienda, ciudadDestino: r.ciudadDestino,
    cajasEsperadas: r.cajasEsperadas, estibasEsperadas: r.estibasEsperadas,
    estado: r.estado, updatedAt: r.updatedAt.toISOString(),
    cargueIniciadoAt: r.cargueIniciadoAt ? r.cargueIniciadoAt.toISOString() : null,
    cargueIniciadoPorId: r.cargueIniciadoPorId ?? null,
  }
}

function mapCargue(c: any) {
  return {
    id: c.id, pedidoId: c.pedidoId, iniciadoPorId: c.iniciadoPorId,
    iniciadoAt: c.iniciadoAt.toISOString(), cantidadEsperada: c.cantidadEsperada,
    cantidadEscaneada: c.cantidadEscaneada, estado: c.estado,
  }
}

// POST /api/cargue-gourmet/[id]/iniciar-cargue
export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, ROLES_PERMITIDOS)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  const d = parsed.data

  const current = await prisma.gourmetPedido.findUnique({
    where: { id },
    select: {
      estado: true, updatedAt: true, orden: true, ciudadDestino: true,
      cajasEsperadas: true, estibasEsperadas: true, creadoPorId: true,
      _count: { select: { estibas: true } },
    },
  })
  if (!current) throw createError({ statusCode: 404, statusMessage: 'No encontrado' })

  const destino: EstadoPedidoGourmet = 'EN_CARGUE'
  const origen = current.estado as EstadoPedidoGourmet
  const check = assertTransicionGourmet(origen, destino, actor.role)
  if (!check.ok) {
    throw createError({ statusCode: check.motivo === 'SIN_PERMISO' ? 403 : 409, statusMessage: check.mensaje, data: { code: check.motivo } })
  }

  if (new Date(d.updatedAt).getTime() !== current.updatedAt.getTime()) {
    throw createError({ statusCode: 409, statusMessage: 'Conflicto: el pedido fue modificado por otro usuario', data: { code: 'CONFLICT' } })
  }

  if (current._count.estibas < 1) {
    throw createError({ statusCode: 409, statusMessage: 'El pedido no tiene estibas registradas — no se puede iniciar el cargue' })
  }
  if (current.cajasEsperadas <= 0) throw createError({ statusCode: 409, statusMessage: 'cajasEsperadas debe ser mayor a 0' })
  if (current.estibasEsperadas <= 0) throw createError({ statusCode: 409, statusMessage: 'estibasEsperadas debe ser mayor a 0' })

  const cargueActivo = await prisma.gourmetCargue.findFirst({ where: { pedidoId: id, estado: 'EN_CARGUE' }, select: { id: true } })
  if (cargueActivo) {
    throw createError({ statusCode: 409, statusMessage: 'Ya existe un cargue activo para este pedido', data: { code: 'CARGUE_ACTIVO_EXISTENTE' } })
  }

  const { pedido, cargue } = await prisma.$transaction(async (tx) => {
    const nuevoCargue = await tx.gourmetCargue.create({
      data: { pedidoId: id, iniciadoPorId: actor.id, cantidadEsperada: current.cajasEsperadas, cantidadEscaneada: 0, estado: 'EN_CARGUE' },
    })
    const pedidoActualizado = await tx.gourmetPedido.update({
      where: { id },
      data: { estado: 'EN_CARGUE', cargueIniciadoAt: new Date(), cargueIniciadoPorId: actor.id },
    })
    return { pedido: pedidoActualizado, cargue: nuevoCargue }
  })

  const destinatariosIds = new Set<string>()
  if (current.creadoPorId) destinatariosIds.add(current.creadoPorId)
  const adminsGerentes = await prisma.user.findMany({ where: { active: true, role: { in: [...ROLES_NOTIFICAR] } }, select: { id: true } })
  adminsGerentes.forEach((u) => destinatariosIds.add(u.id))

  if (destinatariosIds.size > 0) {
    await prisma.notificacion.createMany({
      data: Array.from(destinatariosIds).map((userId) => ({
        userId, titulo: 'Cargue Gourmet iniciado',
        descripcion: `${pedido.tipoOrden} ${pedido.orden} — destino ${pedido.ciudadDestino}`,
        tipo: 'CARGUE_GOURMET', enlace: '/dashboard/cargue-gourmet',
      })),
    }).catch(() => {})
  }

  await prisma.activityLog.create({
    data: { userId: actor.id, action: 'UPDATE', module: 'cargue-gourmet', recordId: pedido.id, details: `Cargue iniciado — ${pedido.tipoOrden} ${pedido.orden}` },
  }).catch(() => {})

  return { success: true, data: { pedido: mapPedido(pedido), cargue: mapCargue(cargue) } }
})
