import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../../../utils/prisma'
import { auditar, ordenPorId, ORDEN_INCLUDE, requireInspeccion } from '../../../../../utils/muebles'
import { mapOrdenMuebles } from '../../../../../utils/mapRow'

const schema = z.object({ inspectorId: z.string().min(1) })

/**
 * POST /api/inspeccion-muebles/:id/linea/:lineaId/iniciar - ARRANCA EL RELOJ de
 * inspeccion del PLU.
 *
 * El inspector va de PLU en PLU, no de orden en orden: el tiempo que interesa es
 * el de revisar cada mueble.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireInspeccion(event)
  const id = getRouterParam(event, 'id')!
  const lineaId = getRouterParam(event, 'lineaId')!

  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Elige tu nombre de la lista' })
  }

  const orden = await ordenPorId(id)
  if (orden.estado !== 'EN_INSPECCION') {
    throw createError({ statusCode: 409, statusMessage: 'Esa orden no esta en inspeccion' })
  }

  if (!orden.ciudadEnvio) {
    throw createError({ statusCode: 409, statusMessage: 'Asigna la ciudad de envío antes de empezar la orden' })
  }
  // Durante el almuerzo la orden esta detenida: reanudar es un gesto explicito.
  if (orden.inspPausaInicio) {
    throw createError({ statusCode: 409, statusMessage: 'La orden esta en almuerzo: termina el almuerzo para seguir' })
  }
  const linea = orden.lineas.find((l) => l.id === lineaId)
  if (!linea) throw createError({ statusCode: 404, statusMessage: 'PLU no encontrado en esta orden' })
  if (linea.estado === 'LISTO') {
    throw createError({ statusCode: 409, statusMessage: 'Ese PLU ya esta inspeccionado' })
  }
  if (linea.estado === 'EN_EBANISTERIA') {
    throw createError({ statusCode: 409, statusMessage: 'Ese PLU esta en ebanisteria: marcalo como entregado primero' })
  }
  if (linea.estado === 'EN_INSPECCION') {
    throw createError({ statusCode: 409, statusMessage: 'Ese PLU ya esta en inspeccion' })
  }
  if (linea.reposicionInicio && !linea.reposicionFin) {
    throw createError({ statusCode: 409, statusMessage: 'Ese PLU esta averiado: espera el repuesto de picking' })
  }

  const inspector = await prisma.inspector.findFirst({
    where: { id: parsed.data.inspectorId, activo: true },
    select: { id: true, nombre: true },
  })
  if (!inspector) throw createError({ statusCode: 404, statusMessage: 'Inspector no encontrado' })

  const now = new Date()
  const actualizada = await prisma.$transaction(async (tx) => {
    await tx.lineaMuebles.update({
      where: { id: lineaId },
      data: {
        estado: 'EN_INSPECCION',
        // Un PLU averiado ya se habia empezado: conservar su primer arranque es
        // lo que hace que la espera del repuesto se pueda descontar.
        inspHoraInicio: linea.inspHoraInicio ?? now,
        inspectorId: inspector.id,
      },
    })
    await tx.inspectorOrdenMuebles.upsert({
      where: { ordenId_inspectorId: { ordenId: orden.id, inspectorId: inspector.id } },
      create: { ordenId: orden.id, inspectorId: inspector.id },
      update: {},
    })
    return tx.ordenMuebles.findUniqueOrThrow({ where: { id: orden.id }, include: ORDEN_INCLUDE })
  })

  await auditar(
    actor.id, 'UPDATE', 'inspeccion-muebles', orden.id,
    `${inspector.nombre} inicio inspeccion del PLU ${linea.plu} (${orden.codigo})`,
  )

  return { success: true, data: mapOrdenMuebles(actualizada) }
})
