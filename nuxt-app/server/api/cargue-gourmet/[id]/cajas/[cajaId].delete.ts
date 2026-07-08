import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../../utils/prisma'
import { requireRole } from '../../../../utils/auth'
import { mapPedidoGourmetDetalle } from '../../../../utils/mapRow'

// Mismo alcance que el POST hermano (agregar caja manual): solo estos dos
// roles, y solo mientras el pedido no haya entrado al flujo de transporte.
const ROLES_PERMITIDOS = ['ADMIN', 'OPERACIONES_GOURMET']
const ESTADOS_EDITABLES = ['BORRADOR', 'UBICACION_ASIGNADA', 'CON_NOVEDAD']

// DELETE /api/cargue-gourmet/[id]/cajas/[cajaId] — elimina una caja mal
// registrada del pedido (ej. código que no corresponde).
export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, ROLES_PERMITIDOS)
  const id = getRouterParam(event, 'id')!
  const cajaId = getRouterParam(event, 'cajaId')!

  const pedido = await prisma.gourmetPedido.findUnique({
    where: { id },
    select: { estado: true, tipoOrden: true, orden: true },
  })
  if (!pedido) throw createError({ statusCode: 404, statusMessage: 'No encontrado' })

  const caja = await prisma.gourmetPedidoCaja.findUnique({ where: { id: cajaId }, select: { id: true, pedidoId: true, codigoCaja: true } })
  if (!caja || caja.pedidoId !== id) throw createError({ statusCode: 404, statusMessage: 'Caja no encontrada en este pedido' })

  if (!ESTADOS_EDITABLES.includes(pedido.estado)) {
    throw createError({ statusCode: 409, statusMessage: `No se puede editar la lista de cajas en estado ${pedido.estado}`, data: { code: 'ESTADO_NO_EDITABLE' } })
  }

  const pedidoActualizado = await prisma.$transaction(async (tx) => {
    await tx.gourmetPedidoCaja.delete({ where: { id: cajaId } })

    // cajasEsperadas se recalcula al conteo real tras eliminar una caja —
    // mismo motivo que en el POST hermano: si no, el encabezado queda
    // desincronizado y "Finalizar" rechaza por conteo distinto sin
    // explicación clara.
    const totalCajas = await tx.gourmetPedidoCaja.count({ where: { pedidoId: id } })
    await tx.gourmetPedido.update({ where: { id }, data: { cajasEsperadas: totalCajas } })

    return tx.gourmetPedido.findUniqueOrThrow({
      where: { id },
      include: {
        creadoPor: { select: { name: true } },
        estibas: { orderBy: { secuencia: 'asc' } },
        cajas: { orderBy: [{ numeroSecuencia: 'asc' }, { createdAt: 'asc' }] },
        cargues: { orderBy: { iniciadoAt: 'desc' }, include: { escaneos: { orderBy: { createdAt: 'desc' } } } },
        novedades: { orderBy: { createdAt: 'desc' } },
      },
    })
  })

  // cargues/novedades no traían nombres de usuario resueltos (columnas
  // planas sin relación Prisma) — sin este mapa, el panel abierto perdía
  // el historial de cargue/novedades después de corregir una caja.
  const actorIds = new Set<string>()
  for (const c of pedidoActualizado.cargues) {
    actorIds.add(c.iniciadoPorId)
    if (c.finalizadoPorId) actorIds.add(c.finalizadoPorId)
    for (const e of c.escaneos) actorIds.add(e.escaneadoPorId)
  }
  for (const n of pedidoActualizado.novedades) {
    actorIds.add(n.registradaPorId)
    if (n.resueltaPorId) actorIds.add(n.resueltaPorId)
  }
  const actores = actorIds.size > 0
    ? await prisma.user.findMany({ where: { id: { in: [...actorIds] } }, select: { id: true, name: true } })
    : []
  const nombrePorId = new Map(actores.map((u) => [u.id, u.name]))

  await prisma.activityLog.create({
    data: { userId: actor.id, action: 'UPDATE', module: 'cargue-gourmet', recordId: id, details: `Caja eliminada — código ${caja.codigoCaja ?? '(sin código)'} (${pedido.tipoOrden} ${pedido.orden})` },
  }).catch(() => {})

  return { success: true, data: mapPedidoGourmetDetalle(pedidoActualizado, nombrePorId) }
})
