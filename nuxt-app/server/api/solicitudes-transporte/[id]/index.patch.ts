import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapSolicitudTransporte } from '../../../utils/mapRow'
import {
  estadoDesdeStella, parseDateOnly, puedeEliminarSolicitudTransporte,
  puedeGestionarSolicitudTransporte, puedeVerSolicitudTransporte,
  validarFlete, validarPlinesSolicitudTransporte, type StellaEstado,
} from '../../../utils/solicitudesTransporteCalc'
import { GESTION_KEYS, patchSchema } from '../../../utils/solicitudesTransporteSchemas'
import { buildCalculatedFields, logSolicitud, SOLICITUD_INCLUDE } from '../../../utils/solicitudesTransporte'

// PATCH /api/solicitudes-transporte/:id
// Sirve a DOS flujos distintos que se distinguen por las claves del body:
//   · gestión      → solo las 6 GESTION_KEYS (transporte programa/cierra)
//   · edición      → solo campos de solicitante (el autor corrige su solicitud)
// El cliente NUNCA debe mezclarlas: en la app Next el formulario de edición hacía
// spread del registro completo, arrastraba `stellaEstado` y devolvía 403 a cualquier
// no gestor que pulsara "Corregir".
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const parsed = patchSchema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    const err = parsed as { error: { issues: Array<{ message: string }> } }
    throw createError({ statusCode: 400, statusMessage: err.error.issues[0]!.message })
  }
  const d = parsed.data as Record<string, any>

  const current = await prisma.solicitudTransporte.findUnique({
    where: { id },
    select: {
      estado: true, stellaEstado: true, creadoPorId: true, fechaSolicitud: true,
      fechaPromesaEntrega: true, cobroFlete: true, valorFlete: true, deletedAt: true,
    },
  })
  if (!current || current.deletedAt) throw createError({ statusCode: 404, statusMessage: 'No encontrado' })
  if (!puedeVerSolicitudTransporte(actor.role, actor.id, current.creadoPorId)) {
    throw createError({ statusCode: 403, statusMessage: 'Sin acceso' })
  }

  const esGestor = puedeGestionarSolicitudTransporte(actor.role)
  const isGestion = (GESTION_KEYS as readonly string[]).some((k) => d[k] !== undefined)
  const isSolicitanteEdit = Object.keys(d).some((k) => !(GESTION_KEYS as readonly string[]).includes(k))

  if (isGestion && !esGestor) {
    throw createError({ statusCode: 403, statusMessage: 'Solo transporte puede gestionar la solicitud' })
  }
  if (isSolicitanteEdit) {
    const puedeEditar = actor.id === current.creadoPorId
      && ['PENDIENTE', 'RECHAZADA', 'REENVIADA'].includes(current.estado)
    const puedeEditarAdmin = puedeEliminarSolicitudTransporte(actor.role)
    if (!puedeEditar && !esGestor) {
      throw createError({ statusCode: 403, statusMessage: 'Solo puedes editar solicitudes pendientes o rechazadas propias' })
    }
    if (['PROGRAMADA', 'EFECTUADA', 'CANCELADA'].includes(current.estado) && !esGestor && !puedeEditarAdmin) {
      throw createError({ statusCode: 409, statusMessage: 'La solicitud ya esta en gestion de transporte' })
    }
  }

  const fechaSolicitud = parseDateOnly(d.fechaSolicitud) ?? current.fechaSolicitud
  const fechaPromesaEntrega = d.fechaPromesaEntrega !== undefined
    ? parseDateOnly(d.fechaPromesaEntrega)
    : current.fechaPromesaEntrega
  if (d.fechaPromesaEntrega !== undefined && !fechaPromesaEntrega) {
    throw createError({ statusCode: 400, statusMessage: 'Fecha promesa invalida' })
  }

  const nextCobroFlete = d.cobroFlete ?? current.cobroFlete
  const nextValorFlete = d.valorFlete !== undefined
    ? d.valorFlete
    : (current.valorFlete === null ? null : Number(current.valorFlete))
  const fleteError = validarFlete(nextCobroFlete, nextValorFlete)
  if (fleteError) throw createError({ statusCode: 400, statusMessage: fleteError })

  const plinesError = d.plines ? validarPlinesSolicitudTransporte(d.plines) : null
  if (plinesError) throw createError({ statusCode: 400, statusMessage: plinesError })

  // Se recalcula SIEMPRE, aunque el PATCH no toque ninguna fecha: el semáforo depende
  // de "hoy", así que un registro guardado hoy debe reflejar su urgencia actual.
  const stellaEstado = (d.stellaEstado ?? current.stellaEstado) as StellaEstado
  const calculated = buildCalculatedFields({ fechaSolicitud, fechaPromesaEntrega, stellaEstado })
  const nextEstado = isGestion && d.stellaEstado ? estadoDesdeStella(d.stellaEstado) : current.estado
  const cantidadCajas = d.cantidadCajas ?? d.unidades ?? undefined

  const row = await prisma.solicitudTransporte.update({
    where: { id },
    data: {
      ...(d.fechaSolicitud !== undefined && { fechaSolicitud }),
      ...(d.areaSolicitante !== undefined && { areaSolicitante: d.areaSolicitante }),
      ...(d.areaOtro !== undefined && { areaOtro: d.areaOtro }),
      ...(d.solicitanteNombre !== undefined && { solicitanteNombre: d.solicitanteNombre }),
      ...(d.solicitanteCorreo !== undefined && { solicitanteCorreo: d.solicitanteCorreo }),
      ...(d.solicitanteTelefono !== undefined && { solicitanteTelefono: d.solicitanteTelefono }),
      ...(d.tipoVenta !== undefined && { tipoVenta: d.tipoVenta }),
      ...(d.numeroPedido !== undefined && { numeroPedido: d.numeroPedido }),
      ...(d.facturaIntegracion !== undefined && { facturaIntegracion: d.facturaIntegracion }),
      ...(d.cobroFlete !== undefined && { cobroFlete: d.cobroFlete }),
      // Condición literal del original: es la única forma de que desmarcar el flete
      // limpie el valor guardado.
      ...(d.valorFlete !== undefined || d.cobroFlete === false
        ? { valorFlete: d.cobroFlete === false ? null : d.valorFlete }
        : {}),
      ...(cantidadCajas !== undefined && { unidades: cantidadCajas }),
      ...(d.volumenEstimado !== undefined && { volumenEstimado: d.volumenEstimado }),
      ...(d.tipoMercancia !== undefined && { tipoMercancia: d.tipoMercancia }),
      ...(d.ciudadOrigen !== undefined && { ciudadOrigen: d.ciudadOrigen }),
      ...(d.zonaRecogida !== undefined && { zonaRecogida: d.zonaRecogida }),
      ...(d.direccionRecogida !== undefined && { direccionRecogida: d.direccionRecogida }),
      ...(d.puntoRecogida !== undefined && { puntoRecogida: d.puntoRecogida }),
      ...(d.puntoRecogidaOtro !== undefined && { puntoRecogidaOtro: d.puntoRecogidaOtro }),
      ...(d.ciudadEntrega !== undefined && { ciudadEntrega: d.ciudadEntrega }),
      ...(d.direccionEntrega !== undefined && { direccionEntrega: d.direccionEntrega }),
      ...(d.zonaEntrega !== undefined && { zonaEntrega: d.zonaEntrega }),
      ...(d.fechaPromesaEntrega !== undefined && { fechaPromesaEntrega }),
      ...(d.ventanaEntrega !== undefined && { ventanaEntrega: d.ventanaEntrega }),
      ...(d.restriccionHoraria !== undefined && { restriccionHoraria: d.restriccionHoraria }),
      ...(d.descripcionRestriccion !== undefined && { descripcionRestriccion: d.descripcionRestriccion }),
      ...(d.tipoServicio !== undefined && { tipoServicio: d.tipoServicio }),
      ...(d.tipoServicioOtro !== undefined && { tipoServicioOtro: d.tipoServicioOtro }),
      ...(d.observacionesSolicitante !== undefined && { observacionesSolicitante: d.observacionesSolicitante }),
      // Reemplazo TOTAL de las líneas. El deleteMany:{} solo es seguro aquí dentro:
      // Prisma lo restringe a la relación de este registro. Sacarlo a un
      // prisma.pluSolicitudTransporte.deleteMany({}) suelto vaciaría la tabla entera.
      ...(d.plines !== undefined && {
        plines: {
          deleteMany: {},
          create: d.plines.map((p: any) => ({
            plu: p.plu.trim().toUpperCase(),
            descripcion: p.descripcion.trim(),
            unidades: p.unidades,
          })),
        },
      }),
      ...(isGestion && {
        ...(d.documentoNetSuite !== undefined && { documentoNetSuite: d.documentoNetSuite }),
        ...(d.stellaEstado !== undefined && { stellaEstado: d.stellaEstado, estado: nextEstado }),
        ...(d.transportadora !== undefined && { transportadora: d.transportadora }),
        ...(d.numeroGuia !== undefined && { numeroGuia: d.numeroGuia }),
        ...(d.fechaProgramacion !== undefined && { fechaProgramacion: parseDateOnly(d.fechaProgramacion) }),
        ...(d.observacionTransporte !== undefined && { observacionTransporte: d.observacionTransporte }),
        gestionadoPorId: actor.id,
      }),
      prioridad: calculated.prioridad,
      semaforo: calculated.semaforo,
      mesSolicitud: calculated.mesSolicitud,
      // Va DESPUÉS del bloque de gestión a propósito: si el autor corrige una
      // rechazada, el estado resultante debe ser REENVIADA.
      ...(current.estado === 'RECHAZADA' && isSolicitanteEdit && {
        estado: 'REENVIADA', motivoRechazo: null, rechazadoAt: null, reenviadoAt: new Date(),
      }),
      ...(current.estado !== nextEstado && isGestion && {
        historial: {
          create: {
            estadoAnterior: current.estado,
            estadoNuevo: nextEstado,
            observacion: d.observacionTransporte ?? null,
            usuarioId: actor.id,
          },
        },
      }),
    } as never,
    include: SOLICITUD_INCLUDE,
  })

  await logSolicitud(
    actor.id, 'UPDATE', id,
    isGestion ? 'Gestion transporte actualizada' : 'Solicitud actualizada',
  )

  return { success: true, data: mapSolicitudTransporte(row) }
})
