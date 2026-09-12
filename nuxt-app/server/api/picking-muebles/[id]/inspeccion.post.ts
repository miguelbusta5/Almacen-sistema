import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import { auditar, ordenPorId, ORDEN_INCLUDE, requirePicking } from '../../../utils/muebles'
import { validarPasoAInspeccion } from '../../../utils/mueblesCalc'
import { mapOrdenMuebles } from '../../../utils/mapRow'

/**
 * POST /api/picking-muebles/:id/inspeccion - CIERRA el reloj de picking y ABRE
 * el de inspeccion, en la misma transaccion.
 *
 * Encadenados a proposito: si fueran dos llamadas quedaria un hueco de tiempo
 * sin dueno entre que el operario suelta la orden y el area la recibe.
 *
 * El operario descarga el equipo al hacer esto, y como la capacidad se calcula
 * sobre las lineas de la orden abierta, vuelve a cero sola.
 */
export default defineEventHandler(async (event) => {
  const actor = await requirePicking(event)
  const id = getRouterParam(event, 'id')!

  const orden = await ordenPorId(id)
  if (orden.operarioId !== actor.id) {
    throw createError({ statusCode: 403, statusMessage: 'Esa orden es de otro operario' })
  }
  if (orden.estado !== 'EN_PICKING') {
    throw createError({ statusCode: 409, statusMessage: 'La orden ya paso a inspeccion' })
  }

  const err = validarPasoAInspeccion(orden.lineas)
  if (err) throw createError({ statusCode: 409, statusMessage: err })

  const now = new Date()
  const actualizada = await prisma.ordenMuebles.update({
    where: { id: orden.id },
    data: { estado: 'EN_INSPECCION', horaPasoInspeccion: now, actualizadoPorId: actor.id },
    include: ORDEN_INCLUDE,
  })

  await auditar(
    actor.id, 'UPDATE', 'picking-muebles', orden.id,
    `Orden ${orden.codigo} pasada a inspeccion con ${orden.lineas.length} PLU`,
  )

  return { success: true, data: mapOrdenMuebles(actualizada) }
})
