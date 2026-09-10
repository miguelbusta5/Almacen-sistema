import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'

/**
 * GET /api/notificaciones - los avisos del actor.
 *
 * Persisten hasta que se abren: uno que se pierde al recargar no sirve para
 * enterarse de algo que paso mientras no mirabas.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)

  const rows = await prisma.notificacion.findMany({
    where: { userId: actor.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })

  return {
    success: true,
    data: rows.map((n) => ({
      id: n.id,
      tipo: n.tipo,
      titulo: n.titulo,
      descripcion: n.descripcion ?? null,
      enlace: n.enlace ?? null,
      leida: n.leida,
      createdAt: n.createdAt.toISOString(),
    })),
    sinLeer: rows.filter((n) => !n.leida).length,
  }
})
