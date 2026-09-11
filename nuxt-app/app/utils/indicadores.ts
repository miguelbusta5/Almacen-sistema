// Cliente del modulo de Indicadores: tipos de la respuesta, etiquetas, colores y
// formato. La cuenta (reloj de pared por persona) vive en el servidor, en
// server/utils/indicadoresCalc.ts; aqui solo se presenta.

export const API_INDICADORES = '/api/indicadores'

// Mismo orden y mismas etiquetas que src/lib/indicadores.ts (hay un test que
// lo comprueba). El orden fija el color: nunca se reparte por posicion.
export const TIPOS_TAREA = [
  'recepcion',
  'movimiento',
  'resurtido',
  'pendiente',
  'contenedor',
] as const
export type TipoTarea = (typeof TIPOS_TAREA)[number]

export const TIPO_TAREA_LABEL: Record<TipoTarea, string> = {
  recepcion: 'Recepción',
  movimiento: 'Movimientos',
  resurtido: 'Resurtido',
  pendiente: 'Pendientes',
  contenedor: 'Recepción de contenedores',
}

/** El color sigue a la tarea en todos los graficos (tokens.css, --viz-*). */
export const TIPO_TAREA_COLOR: Record<TipoTarea, string> = {
  recepcion: 'var(--viz-1)',
  movimiento: 'var(--viz-2)',
  resurtido: 'var(--viz-3)',
  pendiente: 'var(--viz-4)',
  contenedor: 'var(--viz-5)',
}

export const ROL_MEDIDO_LABEL: Record<string, string> = {
  MONTACARGAS: 'Montacarguista',
  OPERARIO_ALMACENAMIENTO: 'Operario',
}

export interface IndicadorPersona {
  id: string
  nombre: string
  rol: string
  segundos: number
  sumaRelojes: number
  porTipo: Record<TipoTarea, number>
  unidades: number
  plus: number
  unidadesPorHora: number | null
  promedioPorPlu: number | null
}

export interface IndicadoresPeriodo {
  resumen: {
    segundos: number
    sumaRelojes: number
    unidades: number
    /** PLUs por persona: un traspaso cuenta para los dos. */
    plus: number
    /** PLUs distintos. */
    registros: number
    unidadesPorHora: number | null
    personas: number
  }
  personas: IndicadorPersona[]
  porDia: { dia: string; segundos: number; unidades: number }[]
  porTipo: Record<TipoTarea, number>
}

export interface RespuestaIndicadores {
  rango: { desde: string; hasta: string }
  equipo: { id: string; nombre: string; rol: string }[]
  data: IndicadoresPeriodo
}

// ── Piezas de los graficos ──────────────────────────────────────────
export interface ColumnaTabla { key: string; label: string; num?: boolean }
export interface FilaTooltip { color?: string; etiqueta: string; valor: string }
export interface EstadoTooltip { x: number; y: number; titulo: string; filas: FilaTooltip[] }

/** Una barra de un grafico de una sola medida. */
export interface BarraH {
  id: string
  etiqueta: string
  valor: number
  /** Lo que se lee en la punta de la barra. */
  texto: string
  /** Solo si cada barra es una categoria con color propio (reparto por tarea). */
  color?: string
  /** Filas extra del tooltip, debajo del valor. */
  detalle?: FilaTooltip[]
}

/** Punto donde anclar el tooltip cuando llega por teclado (sin raton). */
export function anclaDeElemento(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect()
  return { x: r.left + Math.min(r.width, 260), y: r.top + r.height / 2 }
}

/**
 * Por debajo de este tiempo por PLU no se calcula und/hora en el grafico: con
 * 36 segundos y un PLU de 62 unidades salian 6.565 und/hora, y esa barra
 * aplastaba a todo el equipo. En la tabla sigue estando.
 */
export const MIN_SEGUNDOS_PRODUCTIVIDAD = 15 * 60

// ── Rango de fechas ──────────────────────────────────────────────────
export type PresetRango = 'hoy' | '7d' | '30d' | 'mes' | 'custom'

export const PRESETS_RANGO: { key: Exclude<PresetRango, 'custom'>; label: string }[] = [
  { key: 'hoy', label: 'Hoy' },
  { key: '7d', label: '7 días' },
  { key: '30d', label: '30 días' },
  { key: 'mes', label: 'Este mes' },
]

function moverDias(ymd: string, dias: number): string {
  const d = new Date(`${ymd}T12:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** Desde/hasta de un preset, contando el dia de hoy (en Bogota). */
export function rangoDePreset(preset: Exclude<PresetRango, 'custom'>, hoy: string): { desde: string; hasta: string } {
  if (preset === 'hoy') return { desde: hoy, hasta: hoy }
  if (preset === '7d') return { desde: moverDias(hoy, -6), hasta: hoy }
  if (preset === '30d') return { desde: moverDias(hoy, -29), hasta: hoy }
  return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy }
}

// ── Formato ──────────────────────────────────────────────────────────
const fmtEntero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })

export function fmtNumero(n: number | null | undefined): string {
  return n == null ? '—' : fmtEntero.format(n)
}

/** Horas con un decimal, para ejes y totales grandes: "11,7 h". */
export function fmtHorasDecimal(segundos: number): string {
  const h = segundos / 3600
  return `${h.toLocaleString('es-CO', { maximumFractionDigits: h < 10 ? 1 : 0 })} h`
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** "2026-09-10" → "10 sep". */
export function fmtDiaCorto(ymd: string): string {
  const [, m, d] = ymd.split('-')
  return `${Number(d)} ${MESES[Number(m) - 1] ?? ''}`
}

// Espacio duro entre la cifra y el signo: "28 %" no se parte en dos lineas.
const ESPACIO_DURO = String.fromCharCode(160)

/** Porcentaje entero, sin decimales que nadie lee: "40 %". */
export function fmtPorcentaje(parte: number, total: number): string {
  if (total <= 0) return '—'
  return `${Math.round((parte / total) * 100)}${ESPACIO_DURO}%`
}

/**
 * Marcas de eje en numeros redondos (0, 2, 4, 6…). Devuelve el tope del eje
 * como ultima marca, que siempre queda por encima del valor mas alto.
 *
 * Pasos de 1, 2 o 5, sin 2,5: en un eje de minutos 2,5 se leia "3 min".
 */
export function ticksLimpios(max: number, cuantos = 4): number[] {
  if (!(max > 0)) return [0, 1]
  const bruto = max / cuantos
  const mag = 10 ** Math.floor(Math.log10(bruto))
  const paso = [1, 2, 5, 10].map((f) => f * mag).find((p) => p >= bruto) ?? 10 * mag
  const tope = Math.ceil(max / paso) * paso
  const ticks: number[] = []
  for (let v = 0; v <= tope + paso / 2; v += paso) ticks.push(Number(v.toFixed(6)))
  return ticks
}
