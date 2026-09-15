import { defineOperacionAlmacenHandler } from '../../../utils/operacionAlmacen'
import { defineEventHandler, getRouterParam, getQuery, readBody, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapMovimientoMontacargas } from '../../../utils/mapRow'
import { assertGestorMontacargas, MOVIMIENTO_INCLUDE } from '../../../utils/montacargas'

// DELETE /api/montacargas/:id - borrado logico, solo gestores.
export default defineOperacionAlmacenHandler(async (event) => {
  const actor = await requireAuth(event)
  assertGestorMontacargas(actor.role, 'Solo supervision puede eliminar registros')

  const id = getRouterParam(event, 'id')!
  // El motivo llega por query: el body de un DELETE no siempre sobrevive al
  // transporte. Mismo criterio que Exportaciones.
  const sp = getQuery(event)
  const body = (await readBody(event).catch(() => null)) as { motivoCorreccion?: unknown } | null
  const fromQuery = typeof sp.motivo === 'string' ? sp.motivo.trim() : ''
  const fromBody = typeof body?.motivoCorreccion === 'string' ? body.motivoCorreccion.trim() : ''
  const reason = fromQuery || fromBody || 'Borrado logico'

  const current = await prisma.movimientoMontacargas.findUnique({
    where: { id },
    select: { deletedAt: true },
  })
  if (!current || current.deletedAt) {
    throw createError({ statusCode: 404, statusMessage: 'Registro no encontrado' })
  }

  const row = await prisma.movimientoMontacargas.update({
    where: { id },
    data: { deletedAt: new Date(), actualizadoPorId: actor.id, motivoCorreccion: reason },
    include: MOVIMIENTO_INCLUDE,
  })

  await prisma.activityLog.create({
    data: { userId: actor.id, action: 'DELETE', module: 'control-montacargas', recordId: id, details: reason },
  }).catch(() => {})

  return { success: true, data: mapMovimientoMontacargas(row) }
})
