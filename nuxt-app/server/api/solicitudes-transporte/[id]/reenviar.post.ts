import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapSolicitudTransporte } from '../../../utils/mapRow'
import { puedeGestionarSolicitudTransporte } from '../../../utils/solicitudesTransporteCalc'
import { logSolicitud, notifyGestores, SOLICITUD_INCLUDE } from '../../../utils/solicitudesTransporte'

// POST /api/solicitudes-transporte/:id/reenviar — el autor (o un gestor) reenvía una
// solicitud rechazada tras corregirla. Sin body.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const current = await prisma.solicitudTransporte.findUnique({
    where: { id },
    select: { estado: true, creadoPorId: true, solicitanteNombre: true, ciudadEntrega: true, deletedAt: true },
  })
  if (!current || current.deletedAt) throw createError({ statusCode: 404, statusMessage: 'No encontrado' })
  if (actor.id !== current.creadoPorId && !puedeGestionarSolicitudTransporte(actor.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Sin acceso' })
  }
  if (current.estado !== 'RECHAZADA') {
    throw createError({ statusCode: 409, statusMessage: 'Solo se pueden reenviar solicitudes rechazadas' })
  }

  const row = await prisma.solicitudTransporte.update({
    where: { id },
    data: {
      estado: 'REENVIADA',
      motivoRechazo: null,
      rechazadoAt: null,
      reenviadoAt: new Date(),
      historial: {
        create: {
          estadoAnterior: 'RECHAZADA',
          estadoNuevo: 'REENVIADA',
          observacion: 'Solicitud corregida y reenviada',
          usuarioId: actor.id,
        },
      },
    },
    // Con `plines`, igual que en rechazar: si no, desaparecen del detalle abierto.
    include: SOLICITUD_INCLUDE,
  })

  await logSolicitud(actor.id, 'RESUBMIT', id, 'Solicitud reenviada')
  await notifyGestores(
    id, actor.id,
    'Solicitud de transporte reenviada',
    `${current.solicitanteNombre} corrigio la solicitud hacia ${current.ciudadEntrega}`,
  )

  return { success: true, data: mapSolicitudTransporte(row) }
})
