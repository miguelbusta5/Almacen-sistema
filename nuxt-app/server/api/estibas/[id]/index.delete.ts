import { defineEventHandler, getRouterParam, getQuery, readBody, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapEstiba } from '../../../utils/mapRow'
import { assertGestorEstibas, ESTIBA_INCLUDE } from '../../../utils/estibas'

// DELETE /api/estibas/:id — borrado lógico, solo gestores.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertGestorEstibas(actor.role, 'Solo supervisión puede eliminar estibas')

  const id = getRouterParam(event, 'id')!
  // El motivo llega por query: el body de un DELETE no siempre sobrevive al
  // transporte. Mismo criterio que Exportaciones.
  const sp = getQuery(event)
  const body = (await readBody(event).catch(() => null)) as { motivoCorreccion?: unknown } | null
  const fromQuery = typeof sp.motivo === 'string' ? sp.motivo.trim() : ''
  const fromBody = typeof body?.motivoCorreccion === 'string' ? body.motivoCorreccion.trim() : ''
  const reason = fromQuery || fromBody || 'Borrado logico'

  const current = await prisma.estiba.findUnique({ where: { id }, select: { deletedAt: true } })
  if (!current || current.deletedAt) throw createError({ statusCode: 404, statusMessage: 'Estiba no encontrada' })

  const row = await prisma.estiba.update({
    where: { id },
    data: { deletedAt: new Date(), actualizadoPorId: actor.id, motivoCorreccion: reason },
    include: ESTIBA_INCLUDE,
  })

  await prisma.activityLog.create({
    data: { userId: actor.id, action: 'DELETE', module: 'estibas', recordId: id, details: reason },
  }).catch(() => {})

  return { success: true, data: mapEstiba(row) }
})
