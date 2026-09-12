import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../../../utils/prisma'
import { auditar, ordenPorId, ORDEN_INCLUDE, requireInspeccion } from '../../../../../utils/muebles'
import { mapOrdenMuebles } from '../../../../../utils/mapRow'

const schema = z.object({ inspectorId: z.string().min(1) })

/**
 * POST /api/inspeccion-muebles/:id/linea/:lineaId/ebanisteria-recibir - PARA EL
 * RELOJ de ebanisteria y devuelve el PLU a inspeccion.
 *
 * No lo marca listo: el inspector todavia tiene que revisar que volvio bien. Por
 * eso vuelve a EN_INSPECCION y no a LISTO — y por eso una orden cuyos demas PLU
 * ya estan listos sigue abierta hasta que este pase por aqui y se complete.
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
  const linea = orden.lineas.find((l) => l.id === lineaId)
  if (!linea) throw createError({ statusCode: 404, statusMessage: 'PLU no encontrado en esta orden' })
  if (linea.estado !== 'EN_EBANISTERIA') {
    throw createError({ statusCode: 409, statusMessage: 'Ese PLU no esta en ebanisteria' })
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
      data: { estado: 'EN_INSPECCION', ebanisteriaFin: now, recibidoEbanisteriaPorId: inspector.id },
    })
    return tx.ordenMuebles.findUniqueOrThrow({ where: { id: orden.id }, include: ORDEN_INCLUDE })
  })

  await auditar(
    actor.id, 'UPDATE', 'inspeccion-muebles', orden.id,
    `PLU ${linea.plu} entregado por ebanisteria, recibido por ${inspector.nombre}`,
  )

  return { success: true, data: mapOrdenMuebles(actualizada) }
})
