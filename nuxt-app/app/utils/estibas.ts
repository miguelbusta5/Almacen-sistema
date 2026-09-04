// Helpers y DTOs del módulo Estibas (montacargas). CLIENT-SAFE: sin Prisma ni
// nada de servidor. Port de src/lib/estibas.ts — mantener en sync con
// nuxt-app/server/utils/estibasCalc.ts (Nitro y Vue resuelven alias distintos,
// igual que ya pasa con permissions.ts / modulePermissions.ts).

export const API_ESTIBAS = '/api/estibas'

// ── DTOs (forma exacta de mapEstiba en el servidor) ───────────────────
export type EstadoEstiba = 'EN_CURSO' | 'CERRADA'

export interface Estiba {
  id: string
  pedido: string
  plu: string
  ean: string | null
  descripcion: string
  cajas: number
  unidadesPorCaja: number
  unidadesManuales: boolean
  cantidadTotal: number
  ubicacion: string | null
  fecha: string | null
  horaInicio: string
  horaFinalizacion: string | null
  duracionMinutos: number | null
  estado: EstadoEstiba
  motivoCorreccion: string | null
  creadoPorId: string
  creadoPorNombre: string | null
  actualizadoPorId: string | null
  actualizadoPorNombre: string | null
}

export interface EstibaConteos {
  estibasHoy: number
  cajasHoy: number
  unidadesHoy: number
  enCurso: number
  promedioMin: number | null
}

export interface Operario { id: string; nombre: string }

/** Lo que devuelve /api/productos-maestro/buscar. */
export interface ProductoBuscado {
  plu: string
  ean: string | null
  descripcion: string | null
  unidadesPorCaja: number | null
  fabricante: string | null
  marca: string | null
}

// ── Roles ────────────────────────────────────────────────────────────
export const GESTORES_ESTIBAS = [
  'SUPERVISOR_ALMACENAMIENTO', 'GERENTE', 'ADMIN',
]
export const ROLES_ESTIBAS = ['MONTACARGAS', ...GESTORES_ESTIBAS]

export function puedeUsarEstibas(role: string | null | undefined): boolean {
  return Boolean(role && ROLES_ESTIBAS.includes(role))
}

export function puedeGestionarEstibas(role: string | null | undefined): boolean {
  return Boolean(role && GESTORES_ESTIBAS.includes(role))
}

// ── Normalización y validación (espejo de estibasCalc.ts) ────────────
function normalizarCodigo(value: unknown): string {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, ' ')
}

export function normalizarPedido(value: unknown): string {
  return normalizarCodigo(value).replace(/\s/g, '')
}

export function normalizarUbicacion(value: unknown): string {
  return normalizarCodigo(value)
}

export function normalizarCodigoProducto(value: unknown): string {
  return normalizarCodigo(value).replace(/\s/g, '')
}

// Nomenclatura real de la empresa: PEDDM11887.
export const PEDIDO_PATTERN = /^[A-Z]{2,6}\d{3,10}$/
// Ubicación canónica del CEDI: 05-B-25-03-01 (el pasillo puede llevar dígito: G1).
export const UBICACION_PATTERN = /^\d{2}-[A-Z]\d?-\d{2}-\d{2}-\d{2}$/

export function esPedidoValido(pedido: string): boolean {
  return PEDIDO_PATTERN.test(pedido)
}

/** Las ubicaciones fuera del formato canónico (INSPECCION, MUEBLES, ECUADOR…)
 *  son válidas: el histórico tiene 2.406 valores distintos. Solo se marcan. */
export function esUbicacionCanonica(ubicacion: string): boolean {
  return UBICACION_PATTERN.test(ubicacion)
}

/** Réplica de la columna CANTIDAD TOTAL de la planilla. */
export function calcularCantidadTotal(cajas: number, unidadesPorCaja: number): number {
  if (!Number.isFinite(cajas) || !Number.isFinite(unidadesPorCaja)) return 0
  return Math.max(0, Math.round(cajas) * Math.round(unidadesPorCaja))
}

// ── Formato ──────────────────────────────────────────────────────────
export const ESTADO_ESTIBA_LABEL: Record<EstadoEstiba, string> = {
  EN_CURSO: 'En curso',
  CERRADA: 'Cerrada',
}

export function fmtHoraEstiba(iso: string | null): string {
  if (!iso) return 'En curso'
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export function fmtDuracion(min: number | null): string {
  if (min == null) return '—'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/** 'YYYY-MM-DD' del día actual en Bogotá. Mismo Intl que todayBogota del servidor. */
export function hoyBogota(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}
