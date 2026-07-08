import dayjs from 'dayjs'
import { nivelEntregaColorFecha, type AlertaTier } from './guardado'

export type EstadoDespacho =
  | 'CREADO_TIENDA'
  | 'RECHAZADO'
  | 'RECOGIDO_TIENDA'
  | 'ENTREGADO_CEDI'
  | 'ENVIADO_CLIENTE'
  | 'CON_NOVEDAD'

export interface PlinDespacho {
  id: string
  despachoId: string
  plu: string
  descripcion: string | null
  unidades: number
}

export interface GuardadoPendienteInfo {
  id: string
  estado: string
  asignadoAId: string
  asignadoANombre: string | null
  guardadoClientId: string | null
}

export interface Despacho {
  id: string
  centroCostos: string
  numeroDocumento: string
  consecutivo: string
  clienteNombre: string
  clienteDocumento: string | null
  clienteTelefono: string | null
  estado: EstadoDespacho
  fechaCreacion: string
  fechaEntregaComprometida: string | null
  numeroCajas: number | null
  netsuiteId: string | null
  tiendaOrigenCodigo: string | null
  tiendaOrigenNombre: string | null
  ciudadOrigen: string | null
  recibidoAt: string | null
  entregadoCediAt: string | null
  despachadoAt: string | null
  novedadAt: string | null
  rechazadoAt: string | null
  motivoRechazo: string | null
  notaEntrega: string | null
  guardadoPendiente: GuardadoPendienteInfo | null
  direccionEntrega: string | null
  barrio: string | null
  ciudad: string | null
  departamento: string | null
  contactoEntrega: string | null
  telefonoEntrega: string | null
  novedad: string | null
  creadoPorId: string
  creadoPorNombre?: string
  createdAt: string
  updatedAt: string
  plines: PlinDespacho[]
}

// Flujo simplificado a 3 estados: Pendiente recogida → En CEDI → Enviado al
// cliente. RECOGIDO_TIENDA es legado y se muestra igual que "En CEDI".
export const ESTADO_LABEL: Record<EstadoDespacho, string> = {
  CREADO_TIENDA: 'Pendiente recogida',
  RECHAZADO: 'Rechazado',
  RECOGIDO_TIENDA: 'En CEDI',
  ENTREGADO_CEDI: 'En CEDI',
  ENVIADO_CLIENTE: 'Enviado al cliente',
  CON_NOVEDAD: 'Con novedad',
}

export const ESTADO_TONE: Record<EstadoDespacho, string> = {
  CREADO_TIENDA: 'var(--u-critico)',
  RECHAZADO: 'var(--u-critico)',
  RECOGIDO_TIENDA: 'var(--info)',
  ENTREGADO_CEDI: 'var(--info)',
  ENVIADO_CLIENTE: 'var(--u-ok)',
  CON_NOVEDAD: 'var(--u-critico)',
}

export const FLUJO_ESTADOS: EstadoDespacho[] = ['CREADO_TIENDA', 'ENTREGADO_CEDI', 'ENVIADO_CLIENTE']

export function pasoEnFlujo(estado: EstadoDespacho): number {
  // RECOGIDO_TIENDA (legado) ocupa el mismo paso que ENTREGADO_CEDI ("En CEDI").
  if (estado === 'RECOGIDO_TIENDA') return FLUJO_ESTADOS.indexOf('ENTREGADO_CEDI')
  const idx = FLUJO_ESTADOS.indexOf(estado)
  if (idx >= 0) return idx
  return -1
}

// Espejo de nuxt-app/server/utils/tiendaFlow.ts — solo para gatear botones en
// la UI (el servidor siempre revalida; ver requireCan/PUT /api/tienda/[id]).
const ROLES_POR_TRANSICION: Record<string, string[]> = {
  'CREADO_TIENDA-ENTREGADO_CEDI': ['SUPERVISOR_TRANSPORTE', 'GERENTE', 'ADMIN'],
  'CREADO_TIENDA-RECHAZADO': ['SUPERVISOR_TRANSPORTE', 'GERENTE', 'ADMIN'],
  'RECHAZADO-CREADO_TIENDA': ['TIENDA', 'SUPERVISOR_TIENDA', 'SUPERVISOR_TRANSPORTE', 'GERENTE', 'ADMIN'],
  'ENTREGADO_CEDI-ENVIADO_CLIENTE': ['SUPERVISOR_TRANSPORTE', 'GERENTE', 'ADMIN'],
  // Legado
  'RECOGIDO_TIENDA-ENTREGADO_CEDI': ['SUPERVISOR_TRANSPORTE', 'GERENTE', 'ADMIN'],
  'RECOGIDO_TIENDA-ENVIADO_CLIENTE': ['SUPERVISOR_TRANSPORTE', 'GERENTE', 'ADMIN'],
}
export function rolPuedeTransicionar(role: string, origen: EstadoDespacho, destino: EstadoDespacho): boolean {
  if (destino === 'CON_NOVEDAD') return ['SUPERVISOR_TRANSPORTE', 'GERENTE', 'ADMIN'].includes(role)
  return ROLES_POR_TRANSICION[`${origen}-${destino}`]?.includes(role) ?? false
}
export function puedeAsignarGuardado(role: string): boolean {
  return ['SUPERVISOR_TRANSPORTE', 'GERENTE', 'ADMIN'].includes(role)
}
export function puedeRevertir(role: string): boolean {
  return ['ADMIN', 'GERENTE'].includes(role)
}

export function todayISO(): string {
  return dayjs().format('YYYY-MM-DD')
}

export function fmtFecha(iso: string | null): string {
  if (!iso) return '—'
  return dayjs(iso).format('DD/MM/YYYY')
}

export function horasDesde(iso: string): number {
  return dayjs().diff(dayjs(iso), 'hour')
}

// Alerta operativa de una factura: lleva >24h sin recoger, o está en un
// estado que requiere intervención (novedad/rechazo). Usado por el filtro
// "Solo alertas" del toolbar.
export function tieneAlertaDespacho(d: { estado: string; createdAt: string }): boolean {
  if (d.estado === 'CON_NOVEDAD' || d.estado === 'RECHAZADO') return true
  return d.estado === 'CREADO_TIENDA' && horasDesde(d.createdAt) >= 24
}

export interface SlaProgreso {
  diasTotales: number
  diasTranscurridos: number
  diasRestantes: number
  fase: 'ok' | 'proximo' | 'vencido'
  progreso: number
}

// Progreso hacia la entrega comprometida — mismo lenguaje visual que
// calcAlmacenaje() (almacenaje.ts) pero para una sola ventana de tiempo
// (creación → entrega comprometida) en vez de bloques de facturación
// recurrentes.
export function calcSla(createdAt: string, fechaEntregaComprometida: string): SlaProgreso {
  const inicio = dayjs(createdAt).startOf('day')
  const fin = dayjs(fechaEntregaComprometida).startOf('day')
  const hoy = dayjs().startOf('day')

  const diasTotales = Math.max(1, fin.diff(inicio, 'day'))
  const diasTranscurridos = hoy.diff(inicio, 'day')
  const diasRestantes = fin.diff(hoy, 'day')

  const fase: SlaProgreso['fase'] = diasRestantes < 0 ? 'vencido' : diasRestantes <= 2 ? 'proximo' : 'ok'
  const progreso = Math.min(1, Math.max(0, diasTranscurridos / diasTotales))

  return { diasTotales, diasTranscurridos, diasRestantes, fase, progreso }
}

// Tier de urgencia para el pill de la lista — mismo lenguaje visual que
// alertaTier() de Guardados (guardado.ts), adaptado al ciclo de vida de un
// despacho: rechazado/con novedad siempre es crítico; pendiente de recogida
// escala por horas sin recoger; en CEDI escala por proximidad de la entrega
// comprometida (nivelEntregaColorFecha ya usado en la lista).
export function alertaTierDespacho(d: { estado: EstadoDespacho; createdAt: string; fechaEntregaComprometida: string | null }): AlertaTier {
  if (d.estado === 'CON_NOVEDAD' || d.estado === 'RECHAZADO') return 'critico'
  if (d.estado === 'CREADO_TIENDA') {
    const h = horasDesde(d.createdAt)
    if (h >= 72) return 'critico'
    if (h >= 48) return 'alerta'
    if (h >= 24) return 'aviso'
    return 'ok'
  }
  if (d.estado === 'ENTREGADO_CEDI' || d.estado === 'RECOGIDO_TIENDA') {
    const nivel = nivelEntregaColorFecha(d.fechaEntregaComprometida, false)
    if (nivel === 'vencida') return 'critico'
    if (nivel === 'amarillo') return 'aviso'
    return 'ok'
  }
  return 'ok'
}

export const CIUDAD_OPTIONS = [
  'Bogota D.C.', 'Medellin', 'Cali', 'Barranquilla', 'Cartagena', 'Bucaramanga',
  'Pereira', 'Manizales', 'Armenia', 'Cucuta', 'Ibague', 'Santa Marta',
  'Villavicencio', 'Pasto', 'Monteria', 'Sincelejo', 'Valledupar', 'Neiva',
  'Tunja', 'Popayan', 'Riohacha',
]
