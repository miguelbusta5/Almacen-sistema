// Tipos, etiquetas y helpers puros de Solicitudes Transporte (cliente).
// Sin red: el módulo hace sus llamadas desde components/solicitudes-transporte/Module.vue.
// Los gates son espejo EXACTO de los del servidor (server/utils/solicitudesTransporteCalc.ts);
// el servidor siempre revalida.
import { canSeeModule } from './modulePermissions'

export type EstadoSolicitud = 'PENDIENTE' | 'RECHAZADA' | 'REENVIADA' | 'PROGRAMADA' | 'EFECTUADA' | 'CANCELADA'
export type StellaEstado = 'PENDIENTE' | 'PROGRAMADO' | 'EFECTUADO' | 'CANCELADO'
export type PrioridadSolicitud = 'ALTO' | 'MEDIO' | 'BAJO'
export type SemaforoSolicitud = 'SIN_FECHA' | 'VENCIDO' | 'ALERTA' | 'NORMAL' | 'EFECTUADO' | 'CANCELADO'

export interface PluRow {
  id?: string
  plu: string
  descripcion: string
  unidades: number
}

export interface Solicitud {
  id: string
  fechaSolicitud: string | null
  areaSolicitante: string
  areaOtro: string | null
  solicitanteNombre: string
  solicitanteCorreo: string
  solicitanteTelefono: string | null
  tipoVenta: string | null
  numeroPedido: string | null
  facturaIntegracion: string | null
  cobroFlete: boolean | null
  valorFlete: number | null
  cantidadCajas: number | null
  unidades: number | null
  volumenEstimado: string | null
  tipoMercancia: string | null
  ciudadOrigen: string
  zonaRecogida: string | null
  direccionRecogida: string | null
  puntoRecogida: string | null
  puntoRecogidaOtro: string | null
  ciudadEntrega: string
  direccionEntrega: string
  zonaEntrega: string | null
  fechaPromesaEntrega: string | null
  ventanaEntrega: string | null
  restriccionHoraria: boolean | null
  descripcionRestriccion: string | null
  tipoServicio: string | null
  tipoServicioOtro: string | null
  observacionesSolicitante: string | null
  estado: EstadoSolicitud
  stellaEstado: StellaEstado
  documentoNetSuite: string | null
  transportadora: string | null
  numeroGuia: string | null
  fechaProgramacion: string | null
  observacionTransporte: string | null
  prioridad: PrioridadSolicitud | null
  semaforo: SemaforoSolicitud
  mesSolicitud: string | null
  motivoRechazo: string | null
  creadoPorId: string
  creadoPorNombre: string | null
  gestionadoPorId: string | null
  gestionadoPorNombre: string | null
  plines: PluRow[]
  createdAt: string | null
  updatedAt: string | null
}

export interface HistorialItem {
  id: string
  estadoAnterior: EstadoSolicitud | null
  estadoNuevo: EstadoSolicitud
  observacion: string | null
  usuarioNombre: string | null
  createdAt: string | null
}

export interface Catalogos {
  areas: string[]
  ciudades: string[]
  puntosRecogida: string[]
  tiposVenta: string[]
  zonas: string[]
  volumenes: string[]
  tiposMercancia: string[]
  ventanasEntrega: string[]
  tiposServicio: string[]
  transportadoras: string[]
}

export interface GestionForm {
  documentoNetSuite: string
  stellaEstado: StellaEstado
  transportadora: string
  numeroGuia: string
  fechaProgramacion: string
  observacionTransporte: string
}

// ── Etiquetas y tonos ────────────────────────────────────────────────
// El semáforo ES una escala de urgencia, así que usa la rampa --u-*. El estado usa
// tonos semánticos para que dos badges contiguos nunca se confundan entre sí.
export const ESTADO_LABEL: Record<EstadoSolicitud, string> = {
  PENDIENTE: 'Pendiente',
  RECHAZADA: 'Rechazada',
  REENVIADA: 'Reenviada',
  PROGRAMADA: 'Programada',
  EFECTUADA: 'Efectuada',
  CANCELADA: 'Cancelada',
}

export const ESTADO_TONE: Record<EstadoSolicitud, string> = {
  PENDIENTE: 'var(--u-aviso)',
  RECHAZADA: 'var(--u-critico)',
  REENVIADA: 'var(--bill)',
  PROGRAMADA: 'var(--info)',
  EFECTUADA: 'var(--u-ok)',
  CANCELADA: 'var(--faint)',
}

export const SEMAFORO_LABEL: Record<SemaforoSolicitud, string> = {
  SIN_FECHA: 'Sin fecha',
  VENCIDO: 'Vencido',
  ALERTA: 'Por vencer',
  NORMAL: 'En fecha',
  EFECTUADO: 'Efectuado',
  CANCELADO: 'Cancelado',
}

export const SEMAFORO_TONE: Record<SemaforoSolicitud, string> = {
  SIN_FECHA: 'var(--muted)',
  VENCIDO: 'var(--u-emergencia)',
  ALERTA: 'var(--u-aviso)',
  NORMAL: 'var(--u-ok)',
  EFECTUADO: 'var(--u-ok)',
  CANCELADO: 'var(--faint)',
}

export const PRIORIDAD_LABEL: Record<PrioridadSolicitud, string> = {
  ALTO: 'Alta', MEDIO: 'Media', BAJO: 'Baja',
}

export const PRIORIDAD_TONE: Record<PrioridadSolicitud, string> = {
  ALTO: 'var(--u-alerta)', MEDIO: 'var(--u-aviso)', BAJO: 'var(--muted)',
}

export const STELLA_LABEL: Record<StellaEstado, string> = {
  PENDIENTE: 'Pendiente', PROGRAMADO: 'Programado',
  EFECTUADO: 'Efectuado', CANCELADO: 'Cancelado',
}

export const ESTADO_OPTIONS: EstadoSolicitud[] = [
  'PENDIENTE', 'REENVIADA', 'PROGRAMADA', 'EFECTUADA', 'RECHAZADA', 'CANCELADA',
]
export const SEMAFORO_OPTIONS: SemaforoSolicitud[] = [
  'VENCIDO', 'ALERTA', 'NORMAL', 'SIN_FECHA', 'EFECTUADO', 'CANCELADO',
]
export const PRIORIDAD_OPTIONS: PrioridadSolicitud[] = ['ALTO', 'MEDIO', 'BAJO']
export const STELLA_OPTIONS: StellaEstado[] = ['PENDIENTE', 'PROGRAMADO', 'EFECTUADO', 'CANCELADO']

// ── Gates (espejo del servidor) ──────────────────────────────────────
const GESTORES = ['ADMIN', 'GERENTE', 'SUPERVISOR_TRANSPORTE']

export function puedeVerSolicitudes(role: string | null | undefined): boolean {
  return canSeeModule(role, 'solicitudes-transporte')
}

export function puedeGestionar(role: string | null | undefined): boolean {
  return Boolean(role && GESTORES.includes(role))
}

export function puedeBorrar(role: string | null | undefined): boolean {
  return role === 'ADMIN' || role === 'GERENTE'
}

/** Editar: gestores y ADMIN/GERENTE siempre; el autor solo si aún no está en gestión. */
export function puedeEditarSolicitud(
  role: string | null | undefined,
  userId: string | undefined,
  item: Solicitud,
): boolean {
  if (puedeGestionar(role) || puedeBorrar(role)) return true
  return item.creadoPorId === userId && ['PENDIENTE', 'RECHAZADA', 'REENVIADA'].includes(item.estado)
}

export function puedeReenviar(
  role: string | null | undefined,
  userId: string | undefined,
  item: Solicitud,
): boolean {
  if (item.estado !== 'RECHAZADA') return false
  return item.creadoPorId === userId || puedeGestionar(role)
}

// ── Formateo ─────────────────────────────────────────────────────────
export function fmtFechaSol(ymd: string | null): string {
  if (!ymd) return '—'
  const [y, m, d] = ymd.split('-')
  return `${d}/${m}/${y}`
}

export function fmtFechaHoraSol(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota', day: '2-digit', month: '2-digit',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

export function fmtCOP(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
  }).format(value)
}

export function emptyPlu(): PluRow {
  return { plu: '', descripcion: '', unidades: 1 }
}

export function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Las 6 claves que el servidor considera "gestión". El formulario de edición NUNCA
 * debe incluirlas: en la app Next el payload hacía spread del registro completo,
 * arrastraba `stellaEstado` y devolvía 403 a cualquier no gestor que pulsara
 * "Corregir". Se exporta para poder aseverarlo en los payloads.
 */
export const GESTION_KEYS = [
  'documentoNetSuite', 'stellaEstado', 'transportadora',
  'numeroGuia', 'fechaProgramacion', 'observacionTransporte',
] as const
