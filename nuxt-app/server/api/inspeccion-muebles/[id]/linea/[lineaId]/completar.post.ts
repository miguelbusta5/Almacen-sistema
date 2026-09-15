import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../../../utils/prisma'
import { auditar, ordenPorId, ORDEN_INCLUDE, requireInspeccion } from '../../../../../utils/muebles'
import { ordenInspeccionCompleta } from '../../../../../utils/mueblesCalc'
import { mapOrdenMuebles } from '../../../../../utils/mapRow'

/**
 * POST /api/inspeccion-muebles/:id/linea/:lineaId/completar - PARA EL RELOJ de
 * inspeccion del PLU, y si era el ultimo, tambien el de la orden.
 *
 * Un PLU que volvio de ebanisteria se marca listo por aqui igual que cualquier
 * otro: el inspector lo revisa de nuevo antes de darlo por bueno.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireInspeccion(event)
  const id = getRouterParam(event, 'id')!
  const lineaId = getRouterParam(event, 'lineaId')!

  const orden = await ordenPorId(id)
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
    throw createError({
      statusCode: 409,
      statusMessage: 'Ese PLU sigue en ebanisteria: marcalo como entregado antes de darlo por listo',
    })
  }
  if (linea.estado === 'PICKEADA') {
    throw createError({ statusCode: 409, statusMessage: 'Inicia la inspeccion del PLU antes de completarlo' })
  }

  const now = new Date()
  const actualizada = await prisma.$transaction(async (tx) => {
    await tx.lineaMuebles.update({
      where: { id: lineaId },
      data: { estado: 'LISTO', inspHoraFin: now },
    })

    // El reloj de la orden cierra solo cuando NO queda ningun PLU pendiente ni
    // en el taller: si uno sigue en ebanisteria la orden sigue abierta, aunque
    // todos los demas esten listos.
    const lineas = await tx.lineaMuebles.findMany({
      where: { ordenId: orden.id },
      select: { estado: true },
    })
    if (ordenInspeccionCompleta(lineas)) {
      await tx.ordenMuebles.update({
        where: { id: orden.id },
        data: { estado: 'INSPECCIONADA', horaFinInspeccion: now, actualizadoPorId: actor.id },
      })
    }

    return tx.ordenMuebles.findUniqueOrThrow({ where: { id: orden.id }, include: ORDEN_INCLUDE })
  })

  await auditar(
    actor.id, 'UPDATE', 'inspeccion-muebles', orden.id,
    `PLU ${linea.plu} inspeccionado (${orden.codigo})${actualizada.estado === 'INSPECCIONADA' ? ' — orden completa' : ''}`,
  )

  return { success: true, data: mapOrdenMuebles(actualizada) }
})
