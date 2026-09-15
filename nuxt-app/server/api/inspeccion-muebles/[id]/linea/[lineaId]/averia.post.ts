import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../../../utils/prisma'
import { auditar, ordenPorId, ORDEN_INCLUDE, requireInspeccion } from '../../../../../utils/muebles'
import { puedePickear } from '../../../../../utils/mueblesCalc'
import { mapOrdenMuebles } from '../../../../../utils/mapRow'

const schema = z.object({
  inspectorId: z.string().min(1),
  motivo: z.string().min(1).max(500),
  operarioId: z.string().min(1),
  unidades: z.number().int().positive().optional(),
})

/**
 * POST /api/inspeccion-muebles/:id/linea/:lineaId/averia - el mueble llego
 * dañado y hay que reponerlo.
 *
 * El PLU queda marcado y vuelve a la cola de inspeccion: la orden NO cierra
 * hasta que el inspector revise el repuesto. La reposicion se le asigna en el
 * acto a un operario de picking, elegido por el propio inspector, y la espera se
 * descuenta del reloj de inspeccion (igual que la ventana de ebanisteria).
 */
export default defineEventHandler(async (event) => {
  const actor = await requireInspeccion(event)
  const id = getRouterParam(event, 'id')!
  const lineaId = getRouterParam(event, 'lineaId')!

  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const d = parsed.data

  const orden = await ordenPorId(id)
  if (orden.estado !== 'EN_INSPECCION') {
    throw createError({ statusCode: 409, statusMessage: 'Esa orden no esta en inspeccion' })
  }
  const linea = orden.lineas.find((l) => l.id === lineaId)
  if (!linea) throw createError({ statusCode: 404, statusMessage: 'PLU no encontrado en esta orden' })
  if (linea.estado === 'EN_EBANISTERIA') {
    throw createError({ statusCode: 409, statusMessage: 'Ese PLU esta en ebanisteria: recibelo primero' })
  }
  if (linea.reposicionInicio && !linea.reposicionFin) {
    throw createError({ statusCode: 409, statusMessage: 'Ese PLU ya tiene una reposicion en curso' })
  }

  const inspector = await prisma.inspector.findFirst({
    where: { id: d.inspectorId, activo: true },
    select: { id: true, nombre: true },
  })
  if (!inspector) throw createError({ statusCode: 404, statusMessage: 'Inspector no encontrado' })

  const operario = await prisma.user.findFirst({
    where: { id: d.operarioId, active: true },
    select: { id: true, name: true, role: true },
  })
  if (!operario || !puedePickear(operario.role)) {
    throw createError({ statusCode: 404, statusMessage: 'Elige un operario de picking de muebles' })
  }

  const now = new Date()
  const actualizada = await prisma.$transaction(async (tx) => {
    await tx.lineaMuebles.update({
      where: { id: lineaId },
      data: {
        // Vuelve a la cola: se reinspecciona cuando llegue el repuesto. El reloj
        // de inspeccion sigue abierto, pero esta ventana se le descuenta.
        estado: 'PICKEADA',
        averiado: true,
        motivoAveria: d.motivo.trim(),
        reposicionInicio: now,
        reposicionFin: null,
        inspectorId: inspector.id,
      },
    })
    await tx.pendienteMuebles.create({
      data: {
        ordenId: orden.id,
        lineaId,
        plu: linea.plu,
        unidades: d.unidades ?? Math.max(1, linea.unidades),
        motivo: 'AVERIA',
        observacion: d.motivo.trim(),
        estado: 'ASIGNADO',
        creadoPorInspectorId: inspector.id,
        asignadoAId: operario.id,
        asignadoPorId: actor.id,
      },
    })
    return tx.ordenMuebles.findUniqueOrThrow({ where: { id: orden.id }, include: ORDEN_INCLUDE })
  })

  await auditar(
    actor.id, 'UPDATE', 'inspeccion-muebles', orden.id,
    `PLU ${linea.plu} averiado (${orden.codigo}): ${inspector.nombre} pidio reposicion a ${operario.name}`,
  )

  return { success: true, data: mapOrdenMuebles(actualizada) }
})
