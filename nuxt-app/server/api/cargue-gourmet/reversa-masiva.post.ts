import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'

const ROLES_NOTIFICAR = ['ADMIN', 'GERENTE'] as const

// Reversa masiva: acción administrativa para devolver pedidos COMPLETADOS
// (por error) a un estado operativo anterior. Igual que el despacho masivo,
// es un bypass deliberado de la máquina de estados (los estados completos
// son terminales a propósito) — por eso NO usa assertTransicionGourmet y se
// restringe solo a ADMIN.
//
// Destinos:
// - EN_CARGUE: reabre el último cargue con TODOS sus escaneos intactos —
//   el pedido queda como si nunca se hubiera finalizado.
// - ANTES_DEL_CARGUE: descarta el/los cargues (y sus escaneos/novedades,
//   igual que hace "Revertir cargue") y vuelve al predecesor real del
//   pedido: ENVIADO_A_TRANSPORTE si pasó por ahí (legado), si no
//   UBICACION_ASIGNADA — misma regla que revertir-cargue.post.ts.
// - BORRADOR: además de descartar cargues, limpia la asignación de
//   ubicación (las estibas/cajas registradas se conservan; el modal de
//   ubicación las precarga al reasignar).
const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
  destino: z.enum(['EN_CARGUE', 'ANTES_DEL_CARGUE', 'BORRADOR']),
})

const ESTADOS_REVERSABLES = ['CARGUE_COMPLETO', 'CARGUE_COMPLETO_MANUAL']

// Campos de cierre que todo destino limpia en el pedido.
const LIMPIAR_CIERRE = {
  cargueCompletadoAt: null, cargueCompletadoPorId: null,
  esCierreManual: false, cantidadContadaManual: null,
  motivoCierreManual: null, observacionCierreManual: null,
} as const

// POST /api/cargue-gourmet/reversa-masiva
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  if (actor.role !== 'ADMIN') throw createError({ statusCode: 403, statusMessage: 'No tienes permisos para realizar esta acción' })

  const body = await readBody(event)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  const { destino } = parsed.data
  const ids = Array.from(new Set(parsed.data.ids))

  const pedidos = await prisma.gourmetPedido.findMany({
    where: { id: { in: ids } },
    select: { id: true, orden: true, estado: true, enviadoTransporteAt: true, creadoPorId: true },
  })
  const porId = new Map(pedidos.map((p) => [p.id, p]))

  const actualizados: string[] = []
  const omitidos: { id: string; motivo: string }[] = []

  for (const id of ids) {
    const pedido = porId.get(id)
    if (!pedido) { omitidos.push({ id, motivo: 'No encontrado' }); continue }
    if (!ESTADOS_REVERSABLES.includes(pedido.estado)) { omitidos.push({ id, motivo: `Está en estado ${pedido.estado}, no completado` }); continue }

    try {
      await prisma.$transaction(async (tx) => {
        // Mismo lock por pedido que usan el resto de acciones de cierre —
        // serializa contra cualquier otra mutación concurrente del pedido.
        await tx.$queryRaw`SELECT id FROM gourmet_pedidos WHERE id = ${id} FOR UPDATE`

        if (destino === 'EN_CARGUE') {
          const ultimoCargue = await tx.gourmetCargue.findFirst({ where: { pedidoId: id }, orderBy: { iniciadoAt: 'desc' }, select: { id: true } })
          if (!ultimoCargue) throw new Error('SIN_CARGUE')
          await tx.gourmetCargue.update({
            where: { id: ultimoCargue.id },
            data: { estado: 'EN_CARGUE', finalizadoAt: null, finalizadoPorId: null, tipoCierre: null, cantidadContadaManual: null, motivoCierreManual: null },
          })
          await tx.gourmetPedido.update({ where: { id }, data: { estado: 'EN_CARGUE', ...LIMPIAR_CIERRE } })
          return
        }

        // ANTES_DEL_CARGUE y BORRADOR descartan los cargues por completo
        // (los escaneos y novedades de cargue caen en cascada, igual que
        // en "Revertir cargue").
        await tx.gourmetCargue.deleteMany({ where: { pedidoId: id } })

        if (destino === 'ANTES_DEL_CARGUE') {
          const estadoDestino = pedido.enviadoTransporteAt ? 'ENVIADO_A_TRANSPORTE' : 'UBICACION_ASIGNADA'
          await tx.gourmetPedido.update({
            where: { id },
            data: { estado: estadoDestino, cargueIniciadoAt: null, cargueIniciadoPorId: null, ...LIMPIAR_CIERRE },
          })
          return
        }

        // BORRADOR
        await tx.gourmetPedido.update({
          where: { id },
          data: {
            estado: 'BORRADOR',
            cargueIniciadoAt: null, cargueIniciadoPorId: null,
            enviadoTransporteAt: null, enviadoTransportePorId: null,
            ubicacionAsignadaAt: null, ubicacionAsignadaPorId: null,
            ...LIMPIAR_CIERRE,
          },
        })
      })
    } catch (e) {
      omitidos.push({ id, motivo: e instanceof Error && e.message === 'SIN_CARGUE' ? 'No tiene ningún cargue que reabrir' : 'Error al reversar' })
      continue
    }

    actualizados.push(id)

    await prisma.activityLog.create({
      data: { userId: actor.id, action: 'UPDATE', module: 'cargue-gourmet', recordId: id, details: `Reversa masiva a ${destino} — ${pedido.orden}` },
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
          userId, titulo: 'Reversa masiva Cargue Gourmet',
          descripcion: `${actualizados.length} pedido(s) reversado(s) a ${destino} por ${actor.name || actor.email}`,
          tipo: 'CARGUE_GOURMET', enlace: '/dashboard/cargue-gourmet',
        })),
      }).catch(() => {})
    }
  }

  return { success: true, data: { actualizados, omitidos } }
})
