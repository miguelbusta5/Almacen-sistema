// Helpers y DTOs de Control Montacargas y Resurtido. CLIENT-SAFE: sin Prisma ni
// nada de servidor. Port de src/lib/montacargas.ts — mantener en sync con
// nuxt-app/server/utils/montacargasCalc.ts (Nitro y Vue resuelven alias
// distintos, igual que ya pasa con permissions.ts / modulePermissions.ts).
import type { ModuleKey } from './modulePermissions'

export const API_MONTACARGAS = '/api/montacargas'

// ── Tipos de registro ────────────────────────────────────────────────
export type TipoMovimiento = 'RECEPCION' | 'MOVIMIENTO' | 'RESURTIDO'

export const TIPO_MOVIMIENTO_LABEL: Record<TipoMovimiento, string> = {
  RECEPCION: 'Recepción de contenedor',
  MOVIMIENTO: 'Movimiento de depósito',
  RESURTIDO: 'Resurtido',
}

/** ¿Este tipo exige ubicación de origen? La mercancía de contenedor entra sin
 *  ubicación previa; un movimiento y un resurtido salen de algún sitio. */
export function requiereUbicacionInicial(tipo: TipoMovimiento): boolean {
  return tipo !== 'RECEPCION'
}

/** Config de cada flujo. Los tres comparten componentes y API; cambian el copy,
 *  el módulo al que pertenecen y si piden ubicación inicial. */
export interface FlujoConfig {
  tipo: TipoMovimiento
  label: string
  /** Texto corto para la pestaña. */
  tab: string
  descripcion: string
  moduleKey: ModuleKey
}

export const FLUJOS: Record<TipoMovimiento, FlujoConfig> = {
  RECEPCION: {
    tipo: 'RECEPCION',
    label: 'Recepción de contenedor',
    tab: 'Recepción',
    descripcion: 'Mercancía que llega en contenedor y aún no tiene ubicación',
    moduleKey: 'control-montacargas',
  },
  MOVIMIENTO: {
    tipo: 'MOVIMIENTO',
    label: 'Movimiento de depósito',
    tab: 'Movimientos',
    descripcion: 'Traslado de mercancía entre ubicaciones del CEDI',
    moduleKey: 'control-montacargas',
  },
  RESURTIDO: {
    tipo: 'RESURTIDO',
    label: 'Resurtido',
    tab: 'Resurtido',
    descripcion: 'Reposición de mercancía desde depósito',
    moduleKey: 'resurtido',
  },
}

// Pestañas del módulo Control Montacargas, en orden.
export const FLUJOS_MONTACARGAS: FlujoConfig[] = [FLUJOS.RECEPCION, FLUJOS.MOVIMIENTO]

// ── DTOs (forma exacta de mapMovimientoMontacargas en el servidor) ───
export type EstadoMovimiento = 'EN_CURSO' | 'CERRADO'

export interface Movimiento {
  id: string
  tipo: TipoMovimiento
  plu: string
  ean: string | null
  descripcion: string
  cajas: number
  unidadesPorCaja: number
  unidadesManuales: boolean
  hayReguero: boolean
  unidadesSueltas: number
  cantidadTotal: number
  ubicacionInicial: string | null
  ubicacionFinal: string | null
  fecha: string | null
  horaInicio: string
  horaFinalizacion: string | null
  duracionMinutos: number | null
  estado: EstadoMovimiento
  motivoCorreccion: string | null
  creadoPorId: string
  creadoPorNombre: string | null
  actualizadoPorId: string | null
  actualizadoPorNombre: string | null
}

export interface MovimientoConteos {
  registrosHoy: number
  cajasHoy: number
  unidadesHoy: number
  sueltasHoy: number
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
export const GESTORES_MONTACARGAS = [
  'SUPERVISOR_ALMACENAMIENTO', 'GERENTE', 'ADMIN',
]
export const ROLES_MONTACARGAS = ['MONTACARGAS', ...GESTORES_MONTACARGAS]

export function puedeUsarMontacargas(role: string | null | undefined): boolean {
  return Boolean(role && ROLES_MONTACARGAS.includes(role))
}

export function puedeGestionarMontacargas(role: string | null | undefined): boolean {
  return Boolean(role && GESTORES_MONTACARGAS.includes(role))
}

// ── Normalización y validación (espejo de montacargasCalc.ts) ────────
function normalizarCodigo(value: unknown): string {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, ' ')
}

export function normalizarUbicacion(value: unknown): string {
  return normalizarCodigo(value)
}

export function normalizarCodigoProducto(value: unknown): string {
  return normalizarCodigo(value).replace(/\s/g, '')
}

// Ubicación canónica del CEDI: 05-B-25-03-01 (el pasillo puede llevar dígito: G1).
export const UBICACION_PATTERN = /^\d{2}-[A-Z]\d?-\d{2}-\d{2}-\d{2}$/

/** Las ubicaciones fuera del formato canónico (INSPECCION, MUEBLES, ECUADOR…)
 *  son válidas: el histórico tiene 2.406 valores distintos. Solo se marcan. */
export function esUbicacionCanonica(ubicacion: string): boolean {
  return UBICACION_PATTERN.test(ubicacion)
}

/** Cantidad total: cajas master completas más el reguero. */
export function calcularCantidadTotal(
  cajas: number,
  unidadesPorCaja: number,
  unidadesSueltas = 0,
): number {
  if (!Number.isFinite(cajas) || !Number.isFinite(unidadesPorCaja)) return 0
  const sueltas = Number.isFinite(unidadesSueltas) ? Math.max(0, Math.round(unidadesSueltas)) : 0
  return Math.max(0, Math.round(cajas)) * Math.max(0, Math.round(unidadesPorCaja)) + sueltas
}

// ── Formato ──────────────────────────────────────────────────────────
export const ESTADO_MOVIMIENTO_LABEL: Record<EstadoMovimiento, string> = {
  EN_CURSO: 'En curso',
  CERRADO: 'Cerrado',
}

export function fmtHoraMovimiento(iso: string | null): string {
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

export function fmtFechaCorta(fecha: string | null): string {
  if (!fecha) return '—'
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}
