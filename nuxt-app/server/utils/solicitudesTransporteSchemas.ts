// Schemas zod de Solicitudes Transporte. Port 1:1 de los de la app Next
// (src/app/api/solicitudes-transporte/{route,[id]/route}.ts).
// Los MENSAJES son textuales e idénticos a propósito: el cliente los muestra tal cual,
// así que un cambio de redacción aquí cambia lo que ve el usuario.
// Sin Prisma: solo zod y los helpers puros.
import { z } from 'zod'
import {
  TRANSPORTADORA_OPTIONS,
  validarFlete,
  validarPlinesSolicitudTransporte,
} from './solicitudesTransporteCalc'

export const estadoSchema = z.enum(['PENDIENTE', 'RECHAZADA', 'REENVIADA', 'PROGRAMADA', 'EFECTUADA', 'CANCELADA'])
export const prioridadSchema = z.enum(['ALTO', 'MEDIO', 'BAJO'])
export const semaforoSchema = z.enum(['SIN_FECHA', 'VENCIDO', 'ALERTA', 'NORMAL', 'EFECTUADO', 'CANCELADO'])
export const stellaSchema = z.enum(['PENDIENTE', 'PROGRAMADO', 'EFECTUADO', 'CANCELADO'])
export const transportadoraSchema = z.enum(TRANSPORTADORA_OPTIONS)

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/

// Campos del solicitante. Se declaran sueltos para poder derivar el patchSchema
// sin repetirlos y, sobre todo, para tener la lista de claves de solicitante
// separada de las de gestión (ver GESTION_KEYS abajo).
const solicitudBaseShape = {
  fechaSolicitud: z.string().regex(FECHA_RE),
  areaSolicitante: z.string().min(2).max(80),
  areaOtro: z.string().max(120).optional().nullable(),
  solicitanteNombre: z.string().min(2).max(255),
  solicitanteCorreo: z.string().email().max(255),
  solicitanteTelefono: z.string().min(1).max(40),
  tipoVenta: z.string().min(1).max(40),
  numeroPedido: z.string().min(1).max(120),
  facturaIntegracion: z.string().max(120).optional().nullable(),
  cobroFlete: z.boolean(),
  valorFlete: z.number().nonnegative().optional().nullable(),
  cantidadCajas: z.number().int().min(1).optional(),
  unidades: z.number().int().min(1).optional().nullable(),
  volumenEstimado: z.string().min(1).max(30),
  tipoMercancia: z.string().min(1).max(40),
  ciudadOrigen: z.string().min(2).max(80),
  zonaRecogida: z.string().min(1).max(20),
  direccionRecogida: z.string().min(3),
  puntoRecogida: z.string().min(1).max(255),
  puntoRecogidaOtro: z.string().max(255).optional().nullable(),
  ciudadEntrega: z.string().min(2).max(80),
  direccionEntrega: z.string().min(5),
  zonaEntrega: z.string().min(1).max(20),
  fechaPromesaEntrega: z.string().regex(FECHA_RE),
  ventanaEntrega: z.string().min(1).max(40),
  restriccionHoraria: z.boolean(),
  descripcionRestriccion: z.string().optional().nullable(),
  tipoServicio: z.string().min(1).max(80),
  tipoServicioOtro: z.string().max(120).optional().nullable(),
  observacionesSolicitante: z.string().min(1),
  plines: z.array(z.object({
    plu: z.string().min(1).max(100),
    descripcion: z.string().min(1).max(255),
    unidades: z.number().int().min(1),
  })).min(1),
}

export const solicitudCreateSchema = z.object(solicitudBaseShape).superRefine((data, ctx) => {
  const cantidadCajas = data.cantidadCajas ?? data.unidades ?? null
  if (!cantidadCajas) {
    ctx.addIssue({ code: 'custom', path: ['cantidadCajas'], message: 'Cantidad cajas es obligatoria' })
  }
  const fleteError = validarFlete(data.cobroFlete, data.valorFlete ?? null)
  if (fleteError) ctx.addIssue({ code: 'custom', path: ['valorFlete'], message: fleteError })
  const plinesError = validarPlinesSolicitudTransporte(data.plines)
  if (plinesError) ctx.addIssue({ code: 'custom', path: ['plines'], message: plinesError })
  if (data.areaSolicitante === 'Otro' && !data.areaOtro?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['areaOtro'], message: 'Debes indicar el area' })
  }
  if (data.puntoRecogida === 'Otros' && !data.puntoRecogidaOtro?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['puntoRecogidaOtro'], message: 'Debes indicar el punto de recogida' })
  }
  if (data.tipoServicio === 'Otro' && !data.tipoServicioOtro?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['tipoServicioOtro'], message: 'Debes indicar el tipo de servicio' })
  }
  if (data.restriccionHoraria && !data.descripcionRestriccion?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['descripcionRestriccion'], message: 'Debes describir la restriccion horaria' })
  }
})

const gestionShape = {
  documentoNetSuite: z.string().max(120).optional().nullable(),
  stellaEstado: stellaSchema.optional(),
  transportadora: transportadoraSchema.optional().nullable(),
  numeroGuia: z.string().max(120).optional().nullable(),
  fechaProgramacion: z.string().regex(FECHA_RE).optional().nullable(),
  observacionTransporte: z.string().optional().nullable(),
}

export const gestionSchema = z.object(gestionShape)

/**
 * Las 6 claves que convierten un PATCH en "gestión". El PATCH clasifica el body con
 * esta lista, así que el cliente NUNCA debe mezclarlas con campos de solicitante:
 * en la app Next el formulario de edición hacía spread del registro completo y
 * arrastraba `stellaEstado`, lo que devolvía 403 a cualquier no gestor que pulsara
 * "Corregir" — el flujo para el que existe ese botón.
 */
export const GESTION_KEYS = [
  'documentoNetSuite', 'stellaEstado', 'transportadora',
  'numeroGuia', 'fechaProgramacion', 'observacionTransporte',
] as const

export const patchSchema = z.object({
  ...Object.fromEntries(
    Object.entries(solicitudBaseShape).map(([k, v]) => [k, (v as z.ZodTypeAny).optional()]),
  ),
  ...gestionShape,
  // En el PATCH la promesa además puede venir en null explícito.
  fechaPromesaEntrega: z.string().regex(FECHA_RE).optional().nullable(),
}) as z.ZodType<Record<string, unknown>>

export const rejectSchema = z.object({
  motivoRechazo: z.string().min(5).max(1000),
})
