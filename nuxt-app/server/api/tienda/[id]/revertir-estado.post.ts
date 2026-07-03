import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireRole } from '../../../utils/auth'
import { mapDespacho, ESTADO_DESPACHO_LABEL } from '../../../utils/mapRow'
import type { EstadoDespacho } from '../../../utils/tiendaFlow'
import { getErrorCode } from '../../../utils/errors'

const ROLES_PERMITIDOS = ['ADMIN', 'GERENTE'] as const
const ROLES_NOTIFICAR = ['ADMIN', 'GERENTE'] as const

const bodySchema = z.object({ updatedAt: z.string().datetime() })

// Campos por etapa que se limpian al abandonarla al revertir — simétrico a
// los timestamps que el PUT normal establece al avanzar hacia ese estado.
function camposAlAbandonar(estado: EstadoDespacho): Record<string, unknown> {
  switch (estado) {
    case 'RECOGIDO_TIENDA': return { recibidoAt: null }
    case 'ENTREGADO_CEDI': return { entregadoCediAt: null }
    case 'ENVIADO_CLIENTE': return { despachadoAt: null }
    case 'CON_NOVEDAD': return { novedadAt: null }
    case 'RECHAZADO': return { rechazadoAt: null, motivoRechazo: null }
    default: return {}
  }
}

// POST /api/tienda/[id]/revertir-estado — acción excepcional de supervisión
// (ADMIN/GERENTE): revierte al estado anterior real según el último
// HistorialDespacho, en vez de un mapa estático (CON_NOVEDAD puede originarse
// desde varios estados). No reutiliza esTransicionValida (esa tabla solo
// define transiciones hacia adelante del flujo normal).
export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, ROLES_PERMITIDOS)
  const id = getRouterParam(event, 'id')!

  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  const d = parsed.data

  const despacho = await prisma.despachoTienda.findUnique({
    where: { id },
    select: {
      id: true, estado: true, updatedAt: true, numeroDocumento: true, creadoPorId: true,
      guardadoPendiente: { select: { id: true } },
    },
  })
  if (!despacho) throw createError({ statusCode: 404, statusMessage: 'No encontrado' })

  if (despacho.estado === 'CREADO_TIENDA') {
    throw createError({ statusCode: 409, statusMessage: 'El despacho ya está en su estado inicial, no hay nada que revertir', data: { code: 'SIN_HISTORIAL' } })
  }
  if (despacho.guardadoPendiente) {
    throw createError({ statusCode: 409, statusMessage: 'No se puede revertir: este despacho tiene un guardado de transporte asociado. Resuélvelo o elimínalo antes de revertir el estado.', data: { code: 'GUARDADO_ASOCIADO' } })
  }

  const ultimoHistorial = await prisma.historialDespacho.findFirst({
    where: { despachoId: id },
    orderBy: { createdAt: 'desc' },
    select: { estadoAnterior: true },
  })
  if (!ultimoHistorial) {
    throw createError({ statusCode: 409, statusMessage: 'No hay historial de estados para revertir', data: { code: 'SIN_HISTORIAL' } })
  }

  const origen = despacho.estado as EstadoDespacho
  const destino = ultimoHistorial.estadoAnterior as EstadoDespacho

  try {
    const [updatedRow] = await prisma.$transaction([
      prisma.despachoTienda.update({
        where: { id, updatedAt: new Date(d.updatedAt) },
        data: { estado: destino, ...camposAlAbandonar(origen) },
        include: {
          creadoPor: { select: { id: true, name: true } },
          plines: true,
          guardadoPendiente: { include: { asignadoA: { select: { name: true } } } },
        },
      }),
      prisma.historialDespacho.create({
        data: { despachoId: id, estadoAnterior: origen, estadoNuevo: destino, observacion: 'Reversión manual de estado', usuarioId: actor.id },
      }),
    ])

    await prisma.activityLog.create({
      data: {
        userId: actor.id, action: 'UPDATE', module: 'tienda', recordId: id,
        details: `Estado revertido — ${ESTADO_DESPACHO_LABEL[origen] ?? origen} → ${ESTADO_DESPACHO_LABEL[destino] ?? destino}`,
      },
    }).catch(() => {})

    const destinatariosIds = new Set<string>()
    if (despacho.creadoPorId) destinatariosIds.add(despacho.creadoPorId)
    const adminsGerentes = await prisma.user.findMany({
      where: { active: true, role: { in: [...ROLES_NOTIFICAR] } },
      select: { id: true },
    })
    adminsGerentes.forEach((u) => destinatariosIds.add(u.id))
    destinatariosIds.delete(actor.id)

    if (destinatariosIds.size > 0) {
      prisma.notificacion.createMany({
        data: Array.from(destinatariosIds).map((userId) => ({
          userId,
          titulo: 'Estado de despacho revertido',
          descripcion: `Doc. ${despacho.numeroDocumento}: ${ESTADO_DESPACHO_LABEL[origen] ?? origen} → ${ESTADO_DESPACHO_LABEL[destino] ?? destino}`,
          tipo: 'TIENDA',
          enlace: '/dashboard/tienda',
        })),
      }).catch(() => {})
    }

    return { success: true, data: mapDespacho(updatedRow) }
  } catch (e) {
    if (getErrorCode(e) === 'P2025') {
      throw createError({ statusCode: 409, statusMessage: 'Conflicto: el despacho fue modificado por otro usuario', data: { code: 'CONFLICT' } })
    }
    throw e
  }
})
