import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../../../utils/prisma'
import { auditarCargue, camionPorId, mapCargue, requireCargue } from '../../../../../utils/cargueCamion'

/**
 * DELETE /api/cargue-camiones/:id/ordenes/:ordenId - quita la orden que esta
 * en cargue (se agrego por error). Una ya finalizada no se quita: ya cambio el
 * estado en Gourmet/Muebles; eso lo corrige supervision.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireCargue(event)
  const camion = await camionPorId(getRouterParam(event, 'id')!)
  const orden = camion.ordenes.find((o) => o.id === getRouterParam(event, 'ordenId'))
  if (!orden) throw createError({ statusCode: 404, statusMessage: 'Orden no encontrada en este camion' })
  if (orden.horaFin) throw createError({ statusCode: 409, statusMessage: `${orden.codigo} ya se finalizo: no se puede quitar` })
  await prisma.cargueCamionOrden.delete({ where: { id: orden.id } })
  await auditarCargue(actor.id, 'DELETE', camion.id, `Orden ${orden.codigo} quitada del camion (estaba en cargue)`)
  return { success: true, data: mapCargue(await camionPorId(camion.id)) }
})
