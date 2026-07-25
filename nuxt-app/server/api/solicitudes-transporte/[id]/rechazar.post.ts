import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapSolicitudTransporte } from '../../../utils/mapRow'
import { puedeGestionarSolicitudTransporte } from '../../../utils/solicitudesTransporteCalc'
import { rejectSchema } from '../../../utils/solicitudesTransporteSchemas'
import { logSolicitud, notifyCreador, SOLICITUD_INCLUDE } from '../../../utils/solicitudesTransporte'

// POST /api/solicitudes-transporte/:id/rechazar — solo gestores.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  if (!puedeGestionarSolicitudTransporte(actor.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Sin permiso para rechazar solicitudes' })
  }

  const id = getRouterParam(event, 'id')!
  const parsed = rejectSchema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const motivo = parsed.data.motivoRechazo.trim()

  const current = await prisma.solicitudTransporte.findUnique({
    where: { id },
    select: { estado: true, creadoPorId: true, deletedAt: true },
  })
  // La versión Next no comprobaba deletedAt aquí: se podía rechazar una solicitud
  // ya archivada. Se añade la comprobación.
  if (!current || current.deletedAt) throw createError({ statusCode: 404, statusMessage: 'No encontrado' })
  if (['EFECTUADA', 'CANCELADA'].includes(current.estado)) {
    throw createError({ statusCode: 409, statusMessage: 'No se puede rechazar una solicitud finalizada' })
  }

  const row = await prisma.solicitudTransporte.update({
    where: { id },
    data: {
      estado: 'RECHAZADA',
      motivoRechazo: motivo,
      rechazadoAt: new Date(),
      gestionadoPorId: actor.id,
      historial: {
        create: {
          estadoAnterior: current.estado,
          estadoNuevo: 'RECHAZADA',
          observacion: motivo,
          usuarioId: actor.id,
        },
      },
    },
    // `plines` incluido a propósito: sin él la respuesta llega con plines vacío, el
    // cliente la mete en el detalle abierto y los PLUs desaparecen de pantalla como
    // si se hubieran borrado. Era el defecto nº1 de la versión React.
    include: SOLICITUD_INCLUDE,
  })

  await logSolicitud(actor.id, 'REJECT', id, motivo)
  await notifyCreador(
    id, current.creadoPorId,
    'Solicitud de transporte rechazada',
    motivo.slice(0, 200),
  )

  return { success: true, data: mapSolicitudTransporte(row) }
})
