import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { auditar, ordenPorId, ORDEN_INCLUDE, requireInspeccion } from '../../../utils/muebles'
import { mapOrdenMuebles } from '../../../utils/mapRow'

const schema = z.object({ inspectorId: z.string().min(1) })

/**
 * POST /api/inspeccion-muebles/:id/unirse - otro inspector entra a la orden.
 *
 * Una TSDM trae decenas de PLU y la revisan varios a la vez. No hay reparto
 * previo: cada quien toma el PLU que va a revisar y el tiempo queda a su nombre
 * (el inspector va en cada linea). Esto solo deja ver quien esta dentro, para
 * que dos no arranquen el mismo PLU.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireInspeccion(event)
  const id = getRouterParam(event, 'id')!

  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Elige tu nombre de la lista' })
  }

  const orden = await ordenPorId(id)
  if (orden.estado !== 'EN_INSPECCION') {
    throw createError({ statusCode: 409, statusMessage: 'Esa orden no esta en inspeccion' })
  }

  const inspector = await prisma.inspector.findFirst({
    where: { id: parsed.data.inspectorId, activo: true },
    select: { id: true, nombre: true },
  })
  if (!inspector) throw createError({ statusCode: 404, statusMessage: 'Inspector no encontrado' })

  const actualizada = await prisma.$transaction(async (tx) => {
    await tx.inspectorOrdenMuebles.upsert({
      where: { ordenId_inspectorId: { ordenId: orden.id, inspectorId: inspector.id } },
      create: { ordenId: orden.id, inspectorId: inspector.id },
      update: {},
    })
    // La primera persona en entrar queda como dueña de la orden, para que la
    // parrilla siga diciendo de quien es.
    if (!orden.inspectorId) {
      await tx.ordenMuebles.update({ where: { id: orden.id }, data: { inspectorId: inspector.id } })
    }
    return tx.ordenMuebles.findUniqueOrThrow({ where: { id: orden.id }, include: ORDEN_INCLUDE })
  })

  await auditar(
    actor.id, 'UPDATE', 'inspeccion-muebles', orden.id,
    `${inspector.nombre} entro a inspeccionar ${orden.codigo}`,
  )

  return { success: true, data: mapOrdenMuebles(actualizada) }
})
