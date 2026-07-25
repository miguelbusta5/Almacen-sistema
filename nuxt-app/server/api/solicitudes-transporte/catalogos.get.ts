import { defineEventHandler, createError } from 'h3'
import { requireAuth } from '../../utils/auth'
import {
  AREA_SOLICITANTE_OPTIONS, CIUDAD_OPTIONS, PUNTO_RECOGIDA_OPTIONS, TIPO_VENTA_OPTIONS,
  ZONA_OPTIONS, VOLUMEN_OPTIONS, TIPO_MERCANCIA_OPTIONS, VENTANA_ENTREGA_OPTIONS,
  TIPO_SERVICIO_OPTIONS, TRANSPORTADORA_OPTIONS, puedeCrearSolicitudTransporte,
} from '../../utils/solicitudesTransporteCalc'

// GET /api/solicitudes-transporte/catalogos — listas estáticas para los selects.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  if (!puedeCrearSolicitudTransporte(actor.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Sin acceso' })
  }

  return {
    success: true,
    data: {
      areas: [...AREA_SOLICITANTE_OPTIONS],
      ciudades: [...CIUDAD_OPTIONS],
      puntosRecogida: [...PUNTO_RECOGIDA_OPTIONS],
      tiposVenta: [...TIPO_VENTA_OPTIONS],
      zonas: [...ZONA_OPTIONS],
      volumenes: [...VOLUMEN_OPTIONS],
      tiposMercancia: [...TIPO_MERCANCIA_OPTIONS],
      ventanasEntrega: [...VENTANA_ENTREGA_OPTIONS],
      tiposServicio: [...TIPO_SERVICIO_OPTIONS],
      transportadoras: [...TRANSPORTADORA_OPTIONS],
    },
  }
})
