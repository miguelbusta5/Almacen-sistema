// Config y helpers puros de los módulos de Exportación (Ecuador / México / EE.UU.).
// CLIENT-SAFE: no importa Prisma ni nada de servidor.
// Port de src/lib/exportaciones/paises.ts + los helpers puros de src/lib/exportaciones.ts.
// Mantener en sync con nuxt-app/server/utils/exportaciones.ts (Nitro y Vue resuelven
// alias distintos, igual que ya pasa con permissions.ts / modulePermissions.ts).
import type { ModuleKey } from './modulePermissions'

export type PaisExport = 'ecuador' | 'mexico' | 'eeuu'

export interface PaisConfig {
  pais: PaisExport
  /** Label completo del módulo, p.ej. "Exportaciones Ecuador". */
  label: string
  /** Etiqueta corta del país, para Excel y chips. */
  paisLabel: string
  moduleKey: ModuleKey
  /** Nombre de ruta interno de Nuxt = nombre del archivo en app/pages/. */
  routeName: string
  basePath: string
  apiBase: string
  /** Acento identitario del país. Ver nota de diseño abajo. */
  accent: string
}

// Nota de diseño: la regla general del proyecto es que los módulos NO se distinguen
// por color. Exportaciones es la excepción acordada: son tres pantallas idénticas del
// MISMO módulo y el error caro es capturar en el país equivocado, así que el país sí
// lleva acento propio. El acento se usa solo en cromo identitario (hero, banner de
// registro en curso, barra de las KPI, chips); los botones de acción siguen usando el
// verde de marca vía .btn-primary. Ver CLAUDE.md → identidad visual.
export const PAISES_EXPORT: Record<PaisExport, PaisConfig> = {
  ecuador: {
    pais: 'ecuador',
    label: 'Exportaciones Ecuador',
    paisLabel: 'Ecuador',
    moduleKey: 'exportaciones',
    routeName: 'exportaciones',
    basePath: '/dashboard/exportaciones',
    apiBase: '/api/exportaciones',
    accent: 'var(--brand)',
  },
  mexico: {
    pais: 'mexico',
    label: 'Exportaciones México',
    paisLabel: 'México',
    moduleKey: 'exportaciones-mexico',
    routeName: 'exportaciones-mexico',
    basePath: '/dashboard/exportaciones-mexico',
    apiBase: '/api/exportaciones-mexico',
    accent: 'var(--bill)',
  },
  eeuu: {
    pais: 'eeuu',
    label: 'Exportaciones EE.UU',
    paisLabel: 'EE.UU',
    moduleKey: 'exportaciones-eeuu',
    routeName: 'exportaciones-eeuu',
    basePath: '/dashboard/exportaciones-eeuu',
    apiBase: '/api/exportaciones-eeuu',
    accent: 'var(--info)',
  },
}

export const PAISES_EXPORT_LIST: PaisConfig[] = Object.values(PAISES_EXPORT)

// ── DTOs (forma exacta de mapExportacion en el servidor) ──────────────
export interface Exportacion {
  id: string
  numeroCaja: string
  plu: string
  descripcion: string
  unidadEmpaque: number
  fecha: string | null
  horaInicio: string
  horaFinalizacion: string | null
  duracionMinutos: number | null
  motivoCorreccion: string | null
  creadoPorId: string
  creadoPorNombre: string | null
  actualizadoPorId: string | null
  actualizadoPorNombre: string | null
}

export interface UserStat {
  id: string
  nombre: string
  cajas: number
  plusDistintos: number
  totalUnidades: number
  finalizadas: number
  duracionTotalMin: number
  promedioPorCajaMin: number | null
}

export interface ExportConteos {
  cajasHoy: number
  enCurso: number
  unidadesHoy: number
  promedioMin: number | null
}

export interface Operario { id: string; nombre: string }

// ── Roles ────────────────────────────────────────────────────────────
export const GESTORES_EXPORTACIONES = ['ADMIN', 'GERENTE', 'SUPERVISOR_ALMACENAMIENTO']
export const USUARIOS_EXPORTACIONES = ['ETIQUETADO', ...GESTORES_EXPORTACIONES]

export function puedeUsarExportaciones(role: string | null | undefined): boolean {
  return Boolean(role && USUARIOS_EXPORTACIONES.includes(role))
}

export function puedeGestionarExportaciones(role: string | null | undefined): boolean {
  return Boolean(role && GESTORES_EXPORTACIONES.includes(role))
}

// ── Helpers puros ────────────────────────────────────────────────────
export function normalizePlu(value: string): string {
  return value.trim().toUpperCase()
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

export function sumarDias(ymd: string, dias: number): string {
  const d = new Date(`${ymd}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

export function fmtHoraExport(iso: string | null): string {
  if (!iso) return 'En curso'
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function fmtFechaExport(ymd: string | null): string {
  if (!ymd) return '—'
  const [y, m, d] = ymd.split('-')
  return `${d}/${m}/${y}`
}

export function fmtRango(desde: string, hasta: string): string {
  return desde === hasta ? fmtFechaExport(desde) : `${fmtFechaExport(desde)} – ${fmtFechaExport(hasta)}`
}

// Estado del registro: sin hora de finalización sigue en curso.
export const EXPORT_ESTADO_TONE: Record<'en-curso' | 'finalizado', string> = {
  'en-curso': 'var(--info)',
  finalizado: 'var(--u-ok)',
}

export function estadoExport(item: Exportacion): 'en-curso' | 'finalizado' {
  return item.horaFinalizacion ? 'finalizado' : 'en-curso'
}

/** Semáforo del promedio min/caja: ≤5 bien, ≤10 aviso, >10 crítico. */
export function toneProm(min: number | null): string {
  if (min === null) return 'var(--faint)'
  if (min <= 5) return 'var(--u-ok)'
  if (min <= 10) return 'var(--u-aviso)'
  return 'var(--u-critico)'
}

/**
 * Fila Total de la tabla de productividad. `plusDistintos` va en 0 a propósito:
 * los PLU distintos no son sumables entre operarios (se renderiza como "—").
 * Port de calcularTotalProductividad en src/app/(dashboard)/dashboard/exportaciones/_components.tsx.
 */
export function calcularTotalProductividad(stats: UserStat[]): UserStat {
  const total = stats.reduce(
    (acc, s) => ({
      cajas: acc.cajas + s.cajas,
      totalUnidades: acc.totalUnidades + s.totalUnidades,
      finalizadas: acc.finalizadas + s.finalizadas,
      duracionTotalMin: acc.duracionTotalMin + s.duracionTotalMin,
    }),
    { cajas: 0, totalUnidades: 0, finalizadas: 0, duracionTotalMin: 0 },
  )
  return {
    id: '__total__',
    nombre: 'Total',
    cajas: total.cajas,
    plusDistintos: 0,
    totalUnidades: total.totalUnidades,
    finalizadas: total.finalizadas,
    duracionTotalMin: total.duracionTotalMin,
    promedioPorCajaMin:
      total.finalizadas > 0
        ? Math.round((total.duracionTotalMin / total.finalizadas) * 10) / 10
        : null,
  }
}
