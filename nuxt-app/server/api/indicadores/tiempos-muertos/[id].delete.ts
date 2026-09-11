import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { assertGestorMontacargas } from '../../../utils/montacargas'

/**
 * DELETE /api/indicadores/tiempos-muertos/:id
 *
 * Quita una justificacion (borrado logico). El rato vuelve a quedar pendiente,
 * o con la justificacion anterior si la habia: quitar es deshacer, no borrar la
 * historia.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertGestorMontacargas(actor.role, 'Solo supervision puede quitar una justificacion')

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta la justificacion' })

  const { count } = await prisma.justificacionTiempoMuerto.updateMany({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date() },
  })
  if (count === 0) throw createError({ statusCode: 404, statusMessage: 'Esa justificacion ya no existe' })

  await prisma.activityLog.create({
    data: {
      userId: actor.id, action: 'DELETE', module: 'indicadores', recordId: id,
      details: 'Justificacion de tiempo muerto quitada',
    },
  }).catch(() => {})

  return { success: true }
})
