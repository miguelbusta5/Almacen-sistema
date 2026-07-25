import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapSolicitudTransporte, mapHistorialSolicitud } from '../../../utils/mapRow'
import { puedeVerSolicitudTransporte } from '../../../utils/solicitudesTransporteCalc'

// GET /api/solicitudes-transporte/:id — detalle + historial.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const row = await prisma.solicitudTransporte.findUnique({
    where: { id },
    include: {
      creadoPor: { select: { id: true, name: true } },
      gestionadoPor: { select: { id: true, name: true } },
      plines: true,
      historial: {
        include: { usuario: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!row || row.deletedAt) throw createError({ statusCode: 404, statusMessage: 'No encontrado' })
  if (!puedeVerSolicitudTransporte(actor.role, actor.id, row.creadoPorId)) {
    throw createError({ statusCode: 403, statusMessage: 'Sin acceso' })
  }

  return {
    success: true,
    data: mapSolicitudTransporte(row),
    historial: row.historial.map(mapHistorialSolicitud),
  }
})
