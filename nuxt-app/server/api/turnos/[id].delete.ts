import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { assertGestorMontacargas } from '../../utils/montacargas'

/**
 * DELETE /api/turnos/:id - quita un cuadro (borrado logico).
 *
 * Sirve para el cuadro subido por error: los dias que cubria vuelven a medirse
 * sin jornada, o con el cuadro anterior si alguno los cubre.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertGestorMontacargas(actor.role, 'Solo supervision puede quitar un cuadro de turnos')

  const id = getRouterParam(event, 'id')!
  const { count } = await prisma.cuadroTurnos.updateMany({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date() },
  })
  if (count === 0) throw createError({ statusCode: 404, statusMessage: 'Ese cuadro ya no existe' })

  await prisma.activityLog.create({
    data: {
      userId: actor.id, action: 'DELETE', module: 'indicadores', recordId: id,
      details: 'Cuadro de turnos quitado',
    },
  }).catch(() => {})

  return { success: true }
})
