import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { auditar, ordenPorId, ORDEN_INCLUDE, requireInspeccion } from '../../../utils/muebles'
import { mapOrdenMuebles } from '../../../utils/mapRow'

const schema = z.object({
  inspectorId: z.string().min(1),
  accion: z.enum(['iniciar', 'terminar']),
})

/**
 * POST /api/inspeccion-muebles/:id/almuerzo - detiene (y reanuda) la orden.
 *
 * No usa PausaOperativa: esa va por usuario y aqui los inspectores son un
 * catalogo detras de un login compartido. La pausa es de la ORDEN, y alcanza a
 * los PLU que estan en inspeccion en ese momento; el rato se descuenta de los
 * dos relojes.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireInspeccion(event)
  const id = getRouterParam(event, 'id')!

  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Elige tu nombre de la lista' })
  }
  const d = parsed.data

  const orden = await ordenPorId(id)
  if (orden.estado !== 'EN_INSPECCION') {
    throw createError({ statusCode: 409, statusMessage: 'Esa orden no esta en inspeccion' })
  }

  const inspector = await prisma.inspector.findFirst({
    where: { id: d.inspectorId, activo: true },
    select: { id: true, nombre: true },
  })
  if (!inspector) throw createError({ statusCode: 404, statusMessage: 'Inspector no encontrado' })

  const now = new Date()
  const actualizada = await prisma.$transaction(async (tx) => {
    if (d.accion === 'iniciar') {
      if (orden.inspPausaInicio) {
        throw createError({ statusCode: 409, statusMessage: 'Esta orden ya esta en almuerzo' })
      }
      await tx.ordenMuebles.update({
        where: { id: orden.id },
        data: { inspPausaInicio: now, inspPausaInspectorId: inspector.id },
      })
      await tx.lineaMuebles.updateMany({
        where: { ordenId: orden.id, estado: 'EN_INSPECCION' },
        data: { inspPausaInicio: now },
      })
    } else {
      if (!orden.inspPausaInicio) {
        throw createError({ statusCode: 409, statusMessage: 'Esta orden no esta en almuerzo' })
      }
      const segundos = Math.max(0, (now.getTime() - orden.inspPausaInicio.getTime()) / 1000)
      await tx.ordenMuebles.update({
        where: { id: orden.id },
        data: {
          inspPausaInicio: null,
          inspPausaInspectorId: null,
          inspPausaSegundos: { increment: segundos },
        },
      })
      // Solo los PLU que quedaron detenidos: uno abierto despues no se pausa.
      const detenidas = await tx.lineaMuebles.findMany({
        where: { ordenId: orden.id, inspPausaInicio: { not: null } },
        select: { id: true, inspPausaInicio: true },
      })
      for (const l of detenidas) {
        await tx.lineaMuebles.update({
          where: { id: l.id },
          data: {
            inspPausaInicio: null,
            inspPausaSegundos: { increment: Math.max(0, (now.getTime() - l.inspPausaInicio!.getTime()) / 1000) },
          },
        })
      }
    }
    return tx.ordenMuebles.findUniqueOrThrow({ where: { id: orden.id }, include: ORDEN_INCLUDE })
  })

  await auditar(
    actor.id, 'UPDATE', 'inspeccion-muebles', orden.id,
    `${inspector.nombre} ${d.accion === 'iniciar' ? 'inicio' : 'termino'} el almuerzo en ${orden.codigo}`,
  )

  return { success: true, data: mapOrdenMuebles(actualizada) }
})
