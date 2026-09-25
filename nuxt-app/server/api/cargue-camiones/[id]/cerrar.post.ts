import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import { auditarCargue, camionPorId, mapCargue, requireCargue } from '../../../utils/cargueCamion'
import { validarCierreCamion } from '../../../utils/cargueCamionCalc'

/**
 * POST /api/cargue-camiones/:id/cerrar - FINALIZA el cargue del camion (para
 * su reloj). Sin ordenes a medias y con al menos una cargada.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireCargue(event)
  const camion = await camionPorId(getRouterParam(event, 'id')!)
  if (camion.estado !== 'EN_CURSO') throw createError({ statusCode: 409, statusMessage: 'Este camion ya se finalizo' })
  const error = validarCierreCamion(camion.ordenes)
  if (error) throw createError({ statusCode: 409, statusMessage: error })

  await prisma.cargueCamion.update({
    where: { id: camion.id },
    data: { estado: 'CERRADO', horaFinalizacion: new Date(), cerradoPorId: actor.id },
  })
  const bultos = camion.ordenes.reduce((s, o) => s + (o.bultosCargados ?? 0), 0)
  await auditarCargue(actor.id, 'UPDATE', camion.id, `Cargue finalizado: ${camion.ordenes.length} ordenes, ${bultos} bultos`)
  return { success: true, data: mapCargue(await camionPorId(camion.id)) }
})
