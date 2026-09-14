import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../../../utils/prisma'
import { auditar, ordenPorId, ORDEN_INCLUDE, requireInspeccion } from '../../../../../utils/muebles'
import { mapOrdenMuebles } from '../../../../../utils/mapRow'

const schema = z.object({
  inspectorId: z.string().min(1),
  // Obligatorio: sin el motivo, el tiempo de ebanisteria es un numero sin causa
  // y no sirve para atacar el problema de raiz.
  motivo: z.string().min(3).max(500),
})

/**
 * POST /api/inspeccion-muebles/:id/linea/:lineaId/ebanisteria - PAUSA el reloj
 * de inspeccion del PLU y ARRANCA el de ebanisteria.
 *
 * Las dos ventanas se solapan en el tiempo pero no en el significado: la de
 * inspeccion se descuenta (ver duracionInspeccionNetaMinutos), porque mientras
 * el mueble esta en el taller nadie lo esta inspeccionando.
 *
 * El inspector puede seguir con otros PLU y otras ordenes mientras este vuelve.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireInspeccion(event)
  const id = getRouterParam(event, 'id')!
  const lineaId = getRouterParam(event, 'lineaId')!

  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }

  const orden = await ordenPorId(id)
  const linea = orden.lineas.find((l) => l.id === lineaId)
  if (!linea) throw createError({ statusCode: 404, statusMessage: 'PLU no encontrado en esta orden' })
  if (linea.estado !== 'EN_INSPECCION') {
    throw createError({
      statusCode: 409,
      statusMessage: 'Solo se envia a ebanisteria un PLU que se esta inspeccionando',
    })
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
        estado: 'EN_EBANISTERIA',
        ebanisteriaInicio: now,
        motivoEbanisteria: parsed.data.motivo.trim(),
        enviadoEbanisteriaPorId: inspector.id,
      },
    })
    return tx.ordenMuebles.findUniqueOrThrow({ where: { id: orden.id }, include: ORDEN_INCLUDE })
  })

  await auditar(
    actor.id, 'UPDATE', 'inspeccion-muebles', orden.id,
    `PLU ${linea.plu} a ebanisteria por ${inspector.nombre}: ${parsed.data.motivo.trim()}`,
  )

  return { success: true, data: mapOrdenMuebles(actualizada) }
})
