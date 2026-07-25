import { defineEventHandler, readBody, setResponseStatus, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { mapSolicitudTransporte } from '../../utils/mapRow'
import { parseDateOnly, puedeCrearSolicitudTransporte } from '../../utils/solicitudesTransporteCalc'
import { solicitudCreateSchema } from '../../utils/solicitudesTransporteSchemas'
import {
  buildCalculatedFields, logSolicitud, notifyGestores, SOLICITUD_INCLUDE,
} from '../../utils/solicitudesTransporte'

// POST /api/solicitudes-transporte — crear. Nace siempre en PENDIENTE.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  if (!puedeCrearSolicitudTransporte(actor.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Sin acceso' })
  }

  const parsed = solicitudCreateSchema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const d = parsed.data

  const fechaSolicitud = parseDateOnly(d.fechaSolicitud)
  const fechaPromesaEntrega = parseDateOnly(d.fechaPromesaEntrega)
  if (!fechaSolicitud) throw createError({ statusCode: 400, statusMessage: 'Fecha de solicitud invalida' })
  if (!fechaPromesaEntrega) throw createError({ statusCode: 400, statusMessage: 'Fecha promesa invalida' })

  const calculated = buildCalculatedFields({ fechaSolicitud, fechaPromesaEntrega })
  // No existe columna cantidadCajas: se guarda en `unidades`.
  const cantidadCajas = d.cantidadCajas ?? d.unidades!

  const row = await prisma.solicitudTransporte.create({
    data: {
      fechaSolicitud,
      areaSolicitante: d.areaSolicitante,
      areaOtro: d.areaOtro || null,
      solicitanteNombre: d.solicitanteNombre,
      solicitanteCorreo: d.solicitanteCorreo,
      solicitanteTelefono: d.solicitanteTelefono,
      tipoVenta: d.tipoVenta,
      numeroPedido: d.numeroPedido,
      facturaIntegracion: d.facturaIntegracion,
      cobroFlete: d.cobroFlete,
      valorFlete: d.cobroFlete ? d.valorFlete ?? null : null,
      unidades: cantidadCajas,
      volumenEstimado: d.volumenEstimado,
      tipoMercancia: d.tipoMercancia,
      ciudadOrigen: d.ciudadOrigen,
      zonaRecogida: d.zonaRecogida,
      direccionRecogida: d.direccionRecogida,
      puntoRecogida: d.puntoRecogida,
      puntoRecogidaOtro: d.puntoRecogidaOtro || null,
      ciudadEntrega: d.ciudadEntrega,
      direccionEntrega: d.direccionEntrega,
      zonaEntrega: d.zonaEntrega,
      fechaPromesaEntrega,
      ventanaEntrega: d.ventanaEntrega,
      restriccionHoraria: d.restriccionHoraria,
      descripcionRestriccion: d.descripcionRestriccion || null,
      tipoServicio: d.tipoServicio,
      tipoServicioOtro: d.tipoServicioOtro || null,
      observacionesSolicitante: d.observacionesSolicitante,
      prioridad: calculated.prioridad,
      semaforo: calculated.semaforo,
      mesSolicitud: calculated.mesSolicitud,
      creadoPorId: actor.id,
      plines: {
        create: d.plines.map((p) => ({
          plu: p.plu.trim().toUpperCase(),
          descripcion: p.descripcion.trim(),
          unidades: p.unidades,
        })),
      },
      historial: {
        create: {
          estadoAnterior: null,
          estadoNuevo: 'PENDIENTE',
          observacion: 'Solicitud creada',
          usuarioId: actor.id,
        },
      },
    },
    include: SOLICITUD_INCLUDE,
  })

  await logSolicitud(actor.id, 'CREATE', row.id, `Solicitud ${row.ciudadOrigen} -> ${row.ciudadEntrega}`)
  await notifyGestores(
    row.id, actor.id,
    'Nueva solicitud de transporte',
    `${row.solicitanteNombre} solicito servicio hacia ${row.ciudadEntrega}`,
  )

  setResponseStatus(event, 201)
  return { success: true, data: mapSolicitudTransporte(row) }
})
