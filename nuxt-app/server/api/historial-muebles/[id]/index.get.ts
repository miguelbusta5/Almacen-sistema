import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { esGestionMuebles } from '../../../utils/mueblesCalc'
import { mapOrdenMuebles } from '../../../utils/mapRow'
import { ordenPorId } from '../../../utils/muebles'

/** GET /api/historial-muebles/:id - una orden con el tiempo de cada PLU. */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  if (!esGestionMuebles(actor.role)) {
    throw createError({ statusCode: 403, statusMessage: 'El historial de muebles es para supervisión' })
  }
  const orden = await ordenPorId(getRouterParam(event, 'id')!)
  // Las correcciones que ya tuvo la orden, para que se vea que algo se cambio a mano.
  const correcciones = await prisma.activityLog.findMany({
    where: { recordId: orden.id, details: { startsWith: 'Correccion' } },
    select: { createdAt: true, details: true, user: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return {
    success: true,
    data: mapOrdenMuebles(orden),
    correcciones: correcciones.map((c) => ({ fecha: c.createdAt.toISOString(), detalle: c.details, por: c.user?.name ?? '—' })),
    puedeCorregir: actor.role === 'ADMIN',
  }
})
