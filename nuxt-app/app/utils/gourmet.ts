// Tipos y utilidades — Cargue Gourmet. Portado desde la app Next.js
// (src/app/(dashboard)/dashboard/cargue-gourmet/_components.tsx +
// src/lib/gourmetCargueFlow.ts). Solo para etiquetas/colores/visibilidad de
// botones en el cliente — el servidor (server/utils/gourmetFlow.ts) siempre
// revalida cada escritura.
import dayjs from 'dayjs'

export type EstadoPedidoGourmet =
  | 'BORRADOR'
  | 'UBICACION_ASIGNADA'
  | 'ENVIADO_A_TRANSPORTE'
  | 'EN_CARGUE'
  | 'CARGUE_COMPLETO'
  | 'CARGUE_COMPLETO_MANUAL'
  | 'CON_NOVEDAD'
  | 'CANCELADO'

export const ESTADOS_PEDIDO_GOURMET: EstadoPedidoGourmet[] = [
  'BORRADOR', 'UBICACION_ASIGNADA', 'ENVIADO_A_TRANSPORTE', 'EN_CARGUE',
  'CARGUE_COMPLETO', 'CARGUE_COMPLETO_MANUAL', 'CON_NOVEDAD', 'CANCELADO',
]

export const ESTADO_LABEL: Record<EstadoPedidoGourmet, string> = {
  BORRADOR: 'Sin ubicación',
  UBICACION_ASIGNADA: 'Ubicación asignada',
  ENVIADO_A_TRANSPORTE: 'Enviado a Transporte',
  EN_CARGUE: 'En cargue',
  CARGUE_COMPLETO: 'Cargue completo',
  CARGUE_COMPLETO_MANUAL: 'Cerrado manualmente',
  CON_NOVEDAD: 'Con novedad',
  CANCELADO: 'Cancelado',
}

export const ESTADO_TONE: Record<EstadoPedidoGourmet, string> = {
  BORRADOR: 'var(--muted)',
  UBICACION_ASIGNADA: 'var(--info)',
  ENVIADO_A_TRANSPORTE: 'var(--u-aviso)',
  EN_CARGUE: 'var(--u-aviso)',
  CARGUE_COMPLETO: 'var(--u-ok)',
  CARGUE_COMPLETO_MANUAL: 'var(--u-ok)',
  CON_NOVEDAD: 'var(--u-critico)',
  CANCELADO: 'var(--muted)',
}

export interface EstibaGourmet { id: string; secuencia: number; ubicacion: string | null; observacion: string | null }
export interface CajaGourmet { id: string; numeroSecuencia: number | null; codigoCaja: string | null; estibaId: string | null }
export interface EscaneoGourmet { id: string; codigoEscaneado: string; resultado: string; escaneadoPorId: string; escaneadoPorNombre: string | null; createdAt: string }
export interface CargueGourmet {
  id: string; estado: string; cantidadEsperada: number; cantidadEscaneada: number
  tipoCierre: string | null; iniciadoPorId: string; iniciadoPorNombre: string | null; iniciadoAt: string
  finalizadoPorId: string | null; finalizadoPorNombre: string | null; finalizadoAt: string | null
  escaneos: EscaneoGourmet[]
}
export interface NovedadGourmet {
  id: string; tipo: string; estado: string; descripcion: string
  registradaPorId: string; registradaPorNombre: string | null
  resueltaPorId: string | null; resueltaPorNombre: string | null; resueltaAt: string | null
  createdAt: string
}

export type TipoPedidoGourmet = 'GOURMET' | 'MUEBLES'

export interface PedidoGourmet {
  id: string
  orden: string
  tipoOrden: string
  codigoTienda: string
  nombreTienda: string
  ciudadDestino: string
  cajasEsperadas: number
  estibasEsperadas: number
  estado: EstadoPedidoGourmet
  // GOURMET por defecto — MUEBLES habilita "tiene parte 2" al escanear.
  tipoPedido: TipoPedidoGourmet
  creadoPorId: string
  creadoPorNombre: string | null
  createdAt: string
  updatedAt: string
  ubicacionAsignadaAt: string | null
  enviadoTransporteAt: string | null
  cargueIniciadoAt: string | null
  cargueCompletadoAt: string | null
  esCierreManual: boolean
  // Solo en el listado: ubicaciones físicas de las estibas ya unidas por el
  // API en un texto legible ("" si no hay).
  ubicaciones?: string
  // Solo en el detalle:
  ubicacionAsignadaPorId?: string | null
  enviadoTransportePorId?: string | null
  cargueIniciadoPorId?: string | null
  cargueCompletadoPorId?: string | null
  cantidadContadaManual?: number | null
  motivoCierreManual?: string | null
  observacionCierreManual?: string | null
  estibas?: EstibaGourmet[]
  cajas?: CajaGourmet[]
  cargues?: CargueGourmet[]
  novedades?: NovedadGourmet[]
}

export function fmtFechaHora(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function horasDesde(iso: string): number {
  return dayjs().diff(dayjs(iso), 'hour')
}

// Espejo de server/utils/gourmetFlow.ts — solo para gatear botones en la UI
// (el servidor siempre revalida).
const ROLES_POR_TRANSICION: Record<string, string[]> = {
  'BORRADOR-UBICACION_ASIGNADA': ['OPERACIONES_GOURMET', 'ADMIN', 'GERENTE'],
  'BORRADOR-CANCELADO': ['ADMIN', 'GERENTE'],
  'UBICACION_ASIGNADA-UBICACION_ASIGNADA': ['OPERACIONES_GOURMET', 'ADMIN', 'GERENTE'],
  'UBICACION_ASIGNADA-CANCELADO': ['ADMIN', 'GERENTE'],
  'UBICACION_ASIGNADA-EN_CARGUE': ['TRANSPORTE', 'SUPERVISOR_TRANSPORTE', 'OPERACIONES_GOURMET', 'ADMIN', 'GERENTE'],
  'ENVIADO_A_TRANSPORTE-EN_CARGUE': ['TRANSPORTE', 'SUPERVISOR_TRANSPORTE', 'OPERACIONES_GOURMET', 'ADMIN', 'GERENTE'],
  'ENVIADO_A_TRANSPORTE-CANCELADO': ['ADMIN', 'GERENTE'],
  'EN_CARGUE-CARGUE_COMPLETO': ['TRANSPORTE', 'SUPERVISOR_TRANSPORTE', 'OPERACIONES_GOURMET', 'ADMIN', 'GERENTE'],
  'EN_CARGUE-CARGUE_COMPLETO_MANUAL': ['SUPERVISOR_TRANSPORTE', 'OPERACIONES_GOURMET', 'ADMIN', 'GERENTE'],
  'EN_CARGUE-CON_NOVEDAD': ['TRANSPORTE', 'SUPERVISOR_TRANSPORTE', 'OPERACIONES_GOURMET', 'ADMIN', 'GERENTE'],
  'CON_NOVEDAD-CARGUE_COMPLETO_MANUAL': ['SUPERVISOR_TRANSPORTE', 'OPERACIONES_GOURMET', 'ADMIN', 'GERENTE'],
  'CON_NOVEDAD-EN_CARGUE': ['TRANSPORTE', 'SUPERVISOR_TRANSPORTE', 'OPERACIONES_GOURMET', 'ADMIN', 'GERENTE'],
}
export function rolPuedeTransicionarGourmet(role: string, origen: EstadoPedidoGourmet, destino: EstadoPedidoGourmet): boolean {
  return ROLES_POR_TRANSICION[`${origen}-${destino}`]?.includes(role) ?? false
}

const ROLES_TRANSPORTE = ['TRANSPORTE', 'SUPERVISOR_TRANSPORTE', 'OPERACIONES_GOURMET', 'ADMIN', 'GERENTE']
const ROLES_GOURMET = ['OPERACIONES_GOURMET', 'ADMIN', 'GERENTE']
const ROLES_CIERRE_MANUAL = ['SUPERVISOR_TRANSPORTE', 'OPERACIONES_GOURMET', 'ADMIN', 'GERENTE']

export function puedeGourmet(role: string): boolean { return ROLES_GOURMET.includes(role) }
export function puedeTransporte(role: string): boolean { return ROLES_TRANSPORTE.includes(role) }
export function puedeCierreManual(role: string): boolean { return ROLES_CIERRE_MANUAL.includes(role) }
export function puedeEliminarGourmet(role: string): boolean { return ['ADMIN', 'GERENTE'].includes(role) }
// Corregir la lista de cajas de un pedido ya creado (eliminar una caja mal
// registrada y agregar la correcta a mano) — solo ADMIN y OPERACIONES_GOURMET.
export function puedeEditarCajas(role: string): boolean { return ['ADMIN', 'OPERACIONES_GOURMET'].includes(role) }
// Resolver una novedad abierta desbloquea "Finalizar" en ese cargue — solo ADMIN.
export function puedeResolverNovedades(role: string): boolean { return role === 'ADMIN' }
export function puedeDespachoMasivo(role: string): boolean { return role === 'ADMIN' }

export const ESTADOS_INICIABLES_TRANSPORTE: EstadoPedidoGourmet[] = ['UBICACION_ASIGNADA', 'ENVIADO_A_TRANSPORTE']
export const ESTADOS_FINALIZABLES_TRANSPORTE: EstadoPedidoGourmet[] = ['EN_CARGUE']
export const ESTADOS_CIERRE_MANUAL: EstadoPedidoGourmet[] = ['EN_CARGUE', 'CON_NOVEDAD']
export const ESTADOS_NO_DESPACHABLES_MASIVO: EstadoPedidoGourmet[] = ['CARGUE_COMPLETO', 'CARGUE_COMPLETO_MANUAL', 'CANCELADO']
// Mismos estados en los que ya se puede editar la cabecera del pedido —
// una vez enviado a transporte, la lista de cajas queda fija.
export const ESTADOS_EDITABLES_CAJAS: EstadoPedidoGourmet[] = ['BORRADOR', 'UBICACION_ASIGNADA', 'CON_NOVEDAD']

// El flujo "clásico" de asignar ubicación (sin escaneo inicial) codifica la
// cantidad de cajas de la estiba dentro de su observación como texto
// literal "[cajas:N]" (o "[cajas:N] · nota"), para poder reconstruirla al
// reabrir el modal de edición — se decodifica aquí para mostrarla legible
// en vez de cruda (ver PedidoDetail.vue, sección "Ubicación / Estibas").
const CAJAS_TAG_RE = /^\[cajas:(\d+)\]\s*(?:·\s*(.*))?$/
export function decodeEstibaObservacion(raw: string | null): { cantidadCajas: number | null; observacion: string } {
  if (!raw) return { cantidadCajas: null, observacion: '' }
  const m = raw.match(CAJAS_TAG_RE)
  if (!m) return { cantidadCajas: null, observacion: raw }
  return { cantidadCajas: parseInt(m[1]!, 10), observacion: m[2] ?? '' }
}

// Alerta operativa simple para el KPI "Requieren atención": con novedad o
// más de 24h sin ubicación asignada.
export function tieneAlertaGourmet(p: PedidoGourmet): boolean {
  if (p.estado === 'CON_NOVEDAD') return true
  return p.estado === 'BORRADOR' && horasDesde(p.createdAt) >= 24
}

// Formato de código de caja escaneado (solo dígitos, rechaza TSDM/OVDM) —
// espejo de server/utils/gourmetCaja.ts, para dar feedback inmediato en el
// cliente antes de llamar al servidor (que siempre revalida).
const RE_SOLO_NUMEROS = /^\d+$/
const PREFIJOS_ORDEN = ['TSDM', 'OVDM']
// `permitirLetras`: los códigos de caja de MUEBLES empiezan con letras (a
// diferencia de GOURMET, que son solo dígitos). El código de orden
// (TSDM/OVDM) nunca se permite, sin importar el tipo de pedido.
export function validarCodigoCaja(codigo: string, opts?: { permitirLetras?: boolean }): { ok: true } | { ok: false; error: string } {
  const c = codigo.trim()
  if (c.length === 0) return { ok: false, error: 'El código de caja no puede estar vacío.' }
  const upper = c.toUpperCase()
  for (const p of PREFIJOS_ORDEN) {
    if (upper.startsWith(p)) return { ok: false, error: `"${c}" parece un código de orden (${p}…), no de caja. Escanea solo el código de la caja física.` }
  }
  if (!opts?.permitirLetras && !RE_SOLO_NUMEROS.test(c)) return { ok: false, error: `"${c}" no es un código de caja válido — solo se permiten dígitos.` }
  return { ok: true }
}
