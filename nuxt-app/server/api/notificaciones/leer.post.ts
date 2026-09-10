import { defineEventHandler, readBody } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'

/**
 * POST /api/notificaciones/leer - marca avisos como vistos.
 *
 * Sin `ids` marca todos: es lo que pasa al abrir el panel, que es justo el
 * momento en que la persona los ha visto.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  const body = await readBody(event).catch(() => null)
  const ids = Array.isArray(body?.ids) ? (body.ids as string[]) : null

  await prisma.notificacion.updateMany({
    where: { userId: actor.id, leida: false, ...(ids && { id: { in: ids } }) },
    data: { leida: true },
  })

  return { success: true }
})
