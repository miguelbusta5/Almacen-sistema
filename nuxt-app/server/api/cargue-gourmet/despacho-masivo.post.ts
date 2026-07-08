import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { ESTADOS_TERMINALES_GOURMET, type EstadoPedidoGourmet } from '../../utils/gourmetFlow'

const ROLES_NOTIFICAR = ['ADMIN', 'GERENTE'] as const

// Despacho masivo: bypass deliberado del flujo normal de cargue/escaneo de
// cajas — cierra de una vez varios pedidos sin verificación física. Por eso
// NO se apoya en assertTransicionGourmet y se restringe solo a ADMIN.
const MOTIVO_DESPACHO_MASIVO = 'DESPACHO_MASIVO'

const bodySchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(200) })

// POST /api/cargue-gourmet/despacho-masivo
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  if (actor.role !== 'ADMIN') throw createError({ statusCode: 403, statusMessage: 'No tienes permisos para realizar esta acción' })

  const body = await readBody(event)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  const ids = Array.from(new Set(parsed.data.ids))

  const pedidos = await prisma.gourmetPedido.findMany({
    where: { id: { in: ids } },
    select: { id: true, orden: true, estado: true, ciudadDestino: true, cajasEsperadas: true, creadoPorId: true },
  })
  const porId = new Map(pedidos.map((p) => [p.id, p]))

  const actualizados: string[] = []
  const omitidos: { id: string; motivo: string }[] = []

  for (const id of ids) {
    const pedido = porId.get(id)
    if (!pedido) { omitidos.push({ id, motivo: 'No encontrado' }); continue }
    const estado = pedido.estado as EstadoPedidoGourmet
    if (ESTADOS_TERMINALES_GOURMET.includes(estado)) { omitidos.push({ id, motivo: `Ya está en estado ${estado}` }); continue }

    await prisma.$transaction(async (tx) => {
      // Bloquea el pedido antes de decidir si hay cargue activo — evita que
      // un escaneo concurrente sobre el mismo pedido quede pisado a mitad
      // de camino por este cierre masivo (mismo patrón de lock ya usado en
      // el resto de acciones de cierre del módulo).
      await tx.$queryRaw`SELECT id FROM gourmet_pedidos WHERE id = ${id} FOR UPDATE`
      const cargueActivo = await tx.gourmetCargue.findFirst({ where: { pedidoId: id, estado: 'EN_CARGUE' } })

      if (cargueActivo) {
        await tx.gourmetCargue.update({
          where: { id: cargueActivo.id },
          data: { estado: 'CARGUE_COMPLETO_MANUAL', finalizadoAt: new Date(), finalizadoPorId: actor.id, tipoCierre: 'MANUAL', cantidadContadaManual: pedido.cajasEsperadas, motivoCierreManual: MOTIVO_DESPACHO_MASIVO },
        })
      } else {
        await tx.gourmetCargue.create({
          data: {
            pedidoId: id, iniciadoPorId: actor.id, iniciadoAt: new Date(),
            cantidadEsperada: pedido.cajasEsperadas, cantidadEscaneada: 0,
            estado: 'CARGUE_COMPLETO_MANUAL', finalizadoAt: new Date(), finalizadoPorId: actor.id,
            tipoCierre: 'MANUAL', cantidadContadaManual: pedido.cajasEsperadas, motivoCierreManual: MOTIVO_DESPACHO_MASIVO,
          },
        })
      }

      await tx.gourmetPedido.update({
        where: { id },
        data: {
          estado: 'CARGUE_COMPLETO_MANUAL', cargueCompletadoAt: new Date(), cargueCompletadoPorId: actor.id,
          esCierreManual: true, cantidadContadaManual: pedido.cajasEsperadas, motivoCierreManual: MOTIVO_DESPACHO_MASIVO,
          observacionCierreManual: `Despachado masivamente sin verificación de cajas por ${actor.name || actor.email}.`,
        },
      })
    })

    actualizados.push(id)

    await prisma.activityLog.create({
      data: { userId: actor.id, action: 'UPDATE', module: 'cargue-gourmet', recordId: id, details: `Despacho masivo sin verificación — ${pedido.orden}` },
    }).catch(() => {})
  }

  if (actualizados.length > 0) {
    const destinatariosIds = new Set<string>()
    for (const id of actualizados) {
      const creadoPorId = porId.get(id)?.creadoPorId
      if (creadoPorId) destinatariosIds.add(creadoPorId)
    }
    const adminsGerentes = await prisma.user.findMany({ where: { active: true, role: { in: [...ROLES_NOTIFICAR] } }, select: { id: true } })
    adminsGerentes.forEach((u) => destinatariosIds.add(u.id))

    if (destinatariosIds.size > 0) {
      await prisma.notificacion.createMany({
        data: Array.from(destinatariosIds).map((userId) => ({
          userId, titulo: 'Despacho masivo Cargue Gourmet',
          descripcion: `${actualizados.length} pedido(s) despachado(s) sin verificación por ${actor.name || actor.email}`,
          tipo: 'CARGUE_GOURMET', enlace: '/dashboard/cargue-gourmet',
        })),
      }).catch(() => {})
    }
  }

  return { success: true, data: { actualizados, omitidos } }
})
