import { defineEventHandler, readBody, getRouterParam, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireRole } from '../../../utils/auth'
import { assertTransicionGourmet, type EstadoPedidoGourmet } from '../../../utils/gourmetFlow'

const ROLES_PERMITIDOS = ['SUPERVISOR_TRANSPORTE', 'OPERACIONES_GOURMET', 'ADMIN', 'GERENTE']
const ROLES_NOTIFICAR = ['ADMIN', 'GERENTE'] as const
// Estados de cargue desde los que se acepta un cierre manual de contingencia.
const ESTADOS_CARGUE_CERRABLES = ['EN_CARGUE', 'CON_NOVEDAD'] as const
// El motivo se registra automáticamente — el usuario ya no lo escribe.
const MOTIVO_CIERRE_MANUAL_AUTOMATICO = 'TIEMPO'

const bodySchema = z.object({
  cantidadContadaManual: z.number().int().min(0),
  updatedAt: z.string(),
})

function mapPedido(r: any) {
  return {
    id: r.id, orden: r.orden, tipoOrden: r.tipoOrden, codigoTienda: r.codigoTienda,
    nombreTienda: r.nombreTienda, ciudadDestino: r.ciudadDestino, estado: r.estado,
    updatedAt: r.updatedAt.toISOString(), esCierreManual: r.esCierreManual,
    cantidadContadaManual: r.cantidadContadaManual ?? null,
    motivoCierreManual: r.motivoCierreManual ?? null,
    observacionCierreManual: r.observacionCierreManual ?? null,
    cargueCompletadoAt: r.cargueCompletadoAt ? r.cargueCompletadoAt.toISOString() : null,
    cargueCompletadoPorId: r.cargueCompletadoPorId ?? null,
  }
}

function mapCargue(c: any) {
  return {
    id: c.id, pedidoId: c.pedidoId, estado: c.estado, tipoCierre: c.tipoCierre,
    cantidadEsperada: c.cantidadEsperada, cantidadEscaneada: c.cantidadEscaneada,
    cantidadContadaManual: c.cantidadContadaManual ?? null,
    motivoCierreManual: c.motivoCierreManual ?? null,
    observacion: c.observacion ?? null,
    finalizadoAt: c.finalizadoAt ? c.finalizadoAt.toISOString() : null,
    finalizadoPorId: c.finalizadoPorId ?? null,
  }
}

function mapNovedad(n: any) {
  return {
    id: n.id, cargueId: n.cargueId, pedidoId: n.pedidoId, tipo: n.tipo,
    descripcion: n.descripcion, estado: n.estado,
    registradaPorId: n.registradaPorId, resueltaPorId: n.resueltaPorId ?? null,
    resueltaAt: n.resueltaAt ? n.resueltaAt.toISOString() : null,
  }
}

// POST /api/cargue-gourmet/[id]/cierre-manual
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

  // Igual que finalizar.post.ts: todas las comprobaciones + la escritura
  // van juntas dentro de la misma transacción, con el cargue bloqueado
  // (FOR UPDATE), para que un finalizar/cierre-manual/despacho-masivo
  // concurrente sobre el mismo pedido no pueda pisar un cargue que ya se
  // cerró por otra vía.
  const { pedido: pedidoActualizado, cargue: cargueActualizado, novedad } = await prisma.$transaction(async (tx) => {
    const cargue = await tx.gourmetCargue.findFirst({ where: { pedidoId: id, estado: { in: [...ESTADOS_CARGUE_CERRABLES] } } })
    if (!cargue) throw createError({ statusCode: 409, statusMessage: 'No hay un cargue válido para cerrar manualmente' })

    await tx.$queryRaw`SELECT id FROM gourmet_cargues WHERE id = ${cargue.id} FOR UPDATE`

    const pedidoActual = await tx.gourmetPedido.findUniqueOrThrow({ where: { id }, select: { estado: true, updatedAt: true } })
    const destino: EstadoPedidoGourmet = 'CARGUE_COMPLETO_MANUAL'
    const origen = pedidoActual.estado as EstadoPedidoGourmet
    const check = assertTransicionGourmet(origen, destino, actor.role)
    if (!check.ok) {
      throw createError({ statusCode: check.motivo === 'SIN_PERMISO' ? 403 : 409, statusMessage: check.mensaje, data: { code: check.motivo } })
    }
    if (new Date(d.updatedAt).getTime() !== pedidoActual.updatedAt.getTime()) {
      throw createError({ statusCode: 409, statusMessage: 'Conflicto: el pedido fue modificado por otro usuario', data: { code: 'CONFLICT' } })
    }

    // Releer el cargue ya bloqueado — sus cantidades pudieron cambiar
    // entre el findFirst de arriba y adquirir el lock.
    const cargueLocked = await tx.gourmetCargue.findUniqueOrThrow({ where: { id: cargue.id } })
    const descripcion = `Cierre manual — esperadas: ${cargueLocked.cantidadEsperada}, escaneadas: ${cargueLocked.cantidadEscaneada}, ` +
      `contadas manualmente: ${d.cantidadContadaManual}. Motivo: ${MOTIVO_CIERRE_MANUAL_AUTOMATICO}.`

    const novedadCreada = await tx.gourmetCargueNovedad.create({
      data: { cargueId: cargue.id, pedidoId: id, tipo: 'CIERRE_MANUAL', descripcion, estado: 'RESUELTA', registradaPorId: actor.id, resueltaPorId: actor.id, resueltaAt: new Date() },
    })
    const cargueFinal = await tx.gourmetCargue.update({
      where: { id: cargue.id },
      data: { estado: 'CARGUE_COMPLETO_MANUAL', finalizadoAt: new Date(), finalizadoPorId: actor.id, tipoCierre: 'MANUAL', cantidadContadaManual: d.cantidadContadaManual, motivoCierreManual: MOTIVO_CIERRE_MANUAL_AUTOMATICO, observacion: null },
    })
    const pedidoFinal = await tx.gourmetPedido.update({
      where: { id },
      data: { estado: 'CARGUE_COMPLETO_MANUAL', cargueCompletadoAt: new Date(), cargueCompletadoPorId: actor.id, esCierreManual: true, cantidadContadaManual: d.cantidadContadaManual, motivoCierreManual: MOTIVO_CIERRE_MANUAL_AUTOMATICO, observacionCierreManual: null },
    })
    return { pedido: pedidoFinal, cargue: cargueFinal, novedad: novedadCreada }
  })

  const destinatariosIds = new Set<string>()
  if (pedido.creadoPorId) destinatariosIds.add(pedido.creadoPorId)
  const adminsGerentes = await prisma.user.findMany({ where: { active: true, role: { in: [...ROLES_NOTIFICAR] } }, select: { id: true } })
  adminsGerentes.forEach((u) => destinatariosIds.add(u.id))

  if (destinatariosIds.size > 0) {
    await prisma.notificacion.createMany({
      data: Array.from(destinatariosIds).map((userId) => ({
        userId, titulo: 'Cargue Gourmet cerrado manualmente',
        descripcion: `${pedidoActualizado.orden} — destino ${pedidoActualizado.ciudadDestino}. Motivo: ${MOTIVO_CIERRE_MANUAL_AUTOMATICO}`,
        tipo: 'CARGUE_GOURMET', enlace: '/dashboard/cargue-gourmet',
      })),
    }).catch(() => {})
  }

  return { success: true, data: { pedido: mapPedido(pedidoActualizado), cargue: mapCargue(cargueActualizado), novedad: mapNovedad(novedad) } }
})
