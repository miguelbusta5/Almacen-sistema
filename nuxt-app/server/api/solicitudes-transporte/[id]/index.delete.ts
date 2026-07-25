import { defineEventHandler, getRouterParam, getQuery, readBody, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapSolicitudTransporte } from '../../../utils/mapRow'
import { puedeEliminarSolicitudTransporte } from '../../../utils/solicitudesTransporteCalc'
import { logSolicitud, SOLICITUD_INCLUDE } from '../../../utils/solicitudesTransporte'

// DELETE /api/solicitudes-transporte/:id — borrado lógico. Solo ADMIN/GERENTE.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  if (!puedeEliminarSolicitudTransporte(actor.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Solo ADMIN o GERENTE pueden borrar solicitudes' })
  }

  const id = getRouterParam(event, 'id')!
  // El motivo llega por query: el body de un DELETE no siempre sobrevive al
  // transporte. Fallback al body por compatibilidad.
  const sp = getQuery(event)
  const body = (await readBody(event).catch(() => null)) as { deleteReason?: unknown } | null
  const fromQuery = typeof sp.motivo === 'string' ? sp.motivo.trim() : ''
  const fromBody = typeof body?.deleteReason === 'string' ? body.deleteReason.trim() : ''
  const reason = fromQuery || fromBody || 'Eliminada por administracion'

  const current = await prisma.solicitudTransporte.findUnique({
    where: { id },
    select: { estado: true, deletedAt: true },
  })
  if (!current || current.deletedAt) throw createError({ statusCode: 404, statusMessage: 'No encontrado' })

  const row = await prisma.solicitudTransporte.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      deletedById: actor.id,
      deleteReason: reason,
      historial: {
        create: {
          estadoAnterior: current.estado,
          estadoNuevo: current.estado,
          observacion: `Borrado logico: ${reason}`,
          usuarioId: actor.id,
        },
      },
    },
    include: SOLICITUD_INCLUDE,
  })

  await logSolicitud(actor.id, 'DELETE', id, reason)

  return { success: true, data: mapSolicitudTransporte(row) }
})
