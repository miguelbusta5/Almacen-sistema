// Cliente del modulo de Indicadores: tipos de la respuesta, etiquetas, colores y
// formato. La cuenta (reloj de pared por persona) vive en el servidor, en
// server/utils/indicadoresCalc.ts; aqui solo se presenta.

export const API_INDICADORES = '/api/indicadores'
export const API_TIEMPOS_MUERTOS = '/api/indicadores/tiempos-muertos'
export const API_TURNOS = '/api/turnos'

// Mismo orden y mismas etiquetas que src/lib/indicadores.ts (hay un test que
// lo comprueba). El orden fija el color: nunca se reparte por posicion.
export const TIPOS_TAREA = [
  'recepcion',
  'movimiento',
  'resurtido',
  'pendiente',
  'contenedor',
  'tarea',
] as const
export type TipoTarea = (typeof TIPOS_TAREA)[number]

export const TIPO_TAREA_LABEL: Record<TipoTarea, string> = {
  recepcion: 'Recepción',
  movimiento: 'Movimientos',
  resurtido: 'Resurtido',
  pendiente: 'Pendientes',
  contenedor: 'Recepción de contenedores',
  tarea: 'Tareas generales',
}

/** El color sigue a la tarea en todos los graficos (tokens.css, --viz-*). */
export const TIPO_TAREA_COLOR: Record<TipoTarea, string> = {
  recepcion: 'var(--viz-1)',
  movimiento: 'var(--viz-2)',
  resurtido: 'var(--viz-3)',
  pendiente: 'var(--viz-4)',
  contenedor: 'var(--viz-5)',
  tarea: 'var(--viz-6)',
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
  /** Lo que dice el cuadro de turnos que debía trabajar. 0 sin cuadro. */
  jornadaSegundos: number
  /** De su tiempo real, lo que cayó dentro del turno. */
  segundosEnTurno: number
  /** Porcentaje de la jornada con trabajo registrado. Null sin cuadro. */
  efectividad: number | null
  /** Su evolución: un punto por día del periodo. */
  porDia: { dia: string; segundos: number; unidades: number }[]
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
    jornadaSegundos: number
    segundosEnTurno: number
    efectividad: number | null
  }
  personas: IndicadorPersona[]
  porDia: { dia: string; segundos: number; unidades: number }[]
  porTipo: Record<TipoTarea, number>
}

// ── Pausas de alimentación y cambio de baterías ─────────────────────
export type MotivoPausa = 'ALIMENTACION' | 'CAMBIO_BATERIAS'

export const MOTIVO_PAUSA_LABEL: Record<MotivoPausa, string> = {
  ALIMENTACION: 'Alimentación',
  CAMBIO_BATERIAS: 'Cambio de baterías',
}

export interface PausasPeriodo {
  resumen: { veces: Record<MotivoPausa, number>; segundos: Record<MotivoPausa, number>; personas: number }
  personas: {
    id: string
    nombre: string
    rol: string
    veces: Record<MotivoPausa, number>
    segundos: Record<MotivoPausa, number>
    totalVeces: number
    totalSegundos: number
    enPausa: boolean
  }[]
  detalle: {
    id: string
    usuarioId: string
    nombre: string
    motivo: MotivoPausa
    dia: string
    inicio: string
    fin: string | null
    segundos: number
  }[]
}

/** Turno de día o de noche (el de noche cruza la medianoche). */
export type Jornada = 'dia' | 'noche'

export interface RespuestaIndicadores {
  rango: { desde: string; hasta: string }
  turno?: Jornada | null
  equipo: { id: string; nombre: string; rol: string; jornada?: Jornada }[]
  data: IndicadoresPeriodo
  muertos: TiemposMuertosPeriodo
  /** PLUs resurtidos y ritmo de cada operario en el periodo. */
  resurtido?: ResurtidoOperario[]
  /** Kg y m3 que movio cada persona, con el desglose por modulo. */
  carga?: CargaPersona[]
}

export interface CargaPersona {
  id: string
  nombre: string
  kg: number
  m3: number
  /** Trabajos que no se pudieron contar porque su PLU no esta medido. */
  sinMedida: number
  porTipo: Record<'resurtido' | 'pendiente' | 'montacargas', { kg: number; m3: number }>
}

export interface ResurtidoOperario {
  id: string
  nombre: string
  plus: number
  dias: number
  segundos: number
  plusPorHora: number | null
  plusPorDia: number | null
  segundosPorPlu: number | null
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

/** Una fila de un grafico de barras apiladas. */
export interface FilaApilada {
  id: string
  etiqueta: string
  total: number
  /** Lo que se lee en la punta de la barra. */
  texto: string
  segmentos: { key: string; valor: number; color: string }[]
  tooltip: FilaTooltip[]
  /** Referencia detras de la barra (la jornada del turno), si se conoce. */
  fondo?: number
}

// ── Cuadro de turnos ────────────────────────────────────────────────
export const DIA_SEMANA_LABEL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export interface CuadroTurnosDTO {
  id: string
  nombreArchivo: string
  desde: string
  hasta: string
  vigente: boolean
  subidoPor: string
  subidoAt: string
  personas: { id: string; nombre: string; dias: { dia: number; inicioMin: number; finMin: number }[] }[]
  /** Quien se mide y no tiene turno en ese cuadro. */
  sinTurno: string[]
}

/** 930 → "3:30 pm". Como lo escribe operación en el cuadro. */
export function fmtHoraTurno(minutos: number): string {
  const h24 = Math.floor(minutos / 60) % 24
  const m = minutos % 60
  const ampm = h24 < 12 ? 'am' : 'pm'
  const h = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h}${m ? `:${String(m).padStart(2, '0')}` : ''} ${ampm}`
}

/** El turno de un día, ya legible: "6 am – 3:30 pm". */
export function fmtTurno(t: { inicioMin: number; finMin: number }): string {
  return `${fmtHoraTurno(t.inicioMin)} – ${fmtHoraTurno(t.finMin)}`
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
export type PresetRango = 'hoy' | '7d' | '30d' | 'mes' | 'anoche' | 'estaNoche' | '7n' | 'custom'

export const PRESETS_RANGO: { key: Exclude<PresetRango, 'custom'>; label: string }[] = [
  { key: 'hoy', label: 'Hoy' },
  { key: '7d', label: '7 días' },
  { key: '30d', label: '30 días' },
  { key: 'mes', label: 'Este mes' },
]

/**
 * En el turno de noche cada fecha es LA NOCHE QUE EMPIEZA ese día y se mide
 * entera, hasta su cierre a la mañana siguiente. "Anoche" es la última noche que
 * ya terminó; "Esta noche", la que está en curso.
 */
export const PRESETS_NOCHE: { key: Exclude<PresetRango, 'custom'>; label: string }[] = [
  { key: 'anoche', label: 'Anoche' },
  { key: 'estaNoche', label: 'Esta noche' },
  { key: '7n', label: '7 noches' },
  { key: 'mes', label: 'Este mes' },
]

/** "Noche del 13 al 14 sep" para un periodo de una sola noche. */
export function etiquetaNoche(dia: string): string {
  const fmt = (ymd: string) => new Date(`${ymd}T12:00:00-05:00`)
    .toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' })
  return `Noche del ${fmt(dia).replace(/ .*/, '')} al ${fmt(moverDias(dia, 1))}`
}

function moverDias(ymd: string, dias: number): string {
  const d = new Date(`${ymd}T12:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** Desde/hasta de un preset, contando el dia de hoy (en Bogota). */
export function rangoDePreset(preset: Exclude<PresetRango, 'custom'>, hoy: string): { desde: string; hasta: string } {
  if (preset === 'hoy' || preset === 'estaNoche') return { desde: hoy, hasta: hoy }
  if (preset === 'anoche') return { desde: moverDias(hoy, -1), hasta: moverDias(hoy, -1) }
  if (preset === '7n') return { desde: moverDias(hoy, -7), hasta: moverDias(hoy, -1) }
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

// ── Tiempos muertos ──────────────────────────────────────────────────
// Mismos codigos y etiquetas que src/lib/indicadores.ts (hay un test).
export const MOTIVOS_TIEMPO_MUERTO = [
  'ALMUERZO',
  'PAUSA',
  'ESPERA_MERCANCIA',
  'EQUIPO',
  'NOVEDAD',
  'REUNION',
  'ORDEN_ASEO',
  'APOYO_OTRA_AREA',
  'TAREA_SIN_REGISTRO',
  'PERMISO',
  'OTRO',
  'SIN_JUSTIFICACION',
] as const
export type MotivoTiempoMuerto = (typeof MOTIVOS_TIEMPO_MUERTO)[number]

export const MOTIVO_TIEMPO_MUERTO_LABEL: Record<MotivoTiempoMuerto, string> = {
  ALMUERZO: 'Almuerzo',
  PAUSA: 'Pausa activa o descanso',
  ESPERA_MERCANCIA: 'Esperando mercancía o contenedor',
  EQUIPO: 'Montacargas o equipo no disponible',
  NOVEDAD: 'Verificando una novedad',
  REUNION: 'Reunión o capacitación',
  ORDEN_ASEO: 'Orden y aseo',
  APOYO_OTRA_AREA: 'Apoyo a otra área',
  TAREA_SIN_REGISTRO: 'Tarea sin toma de tiempo',
  PERMISO: 'Permiso o ausencia',
  OTRO: 'Otro',
  SIN_JUSTIFICACION: 'Sin justificación',
}

export type EstadoTiempoMuerto = 'pendiente' | 'justificado' | 'sin_justificacion'

// "Por justificar" y no "Pendiente": en esta app Pendientes es un modulo.
// El orden es el de las barras apiladas: rojo y verde nunca van juntos.
export const ESTADOS_TIEMPO_MUERTO: { key: EstadoTiempoMuerto; label: string; color: string }[] = [
  { key: 'sin_justificacion', label: 'Sin justificación', color: 'var(--viz-sin-justificar)' },
  { key: 'pendiente', label: 'Por justificar', color: 'var(--viz-por-justificar)' },
  { key: 'justificado', label: 'Justificado', color: 'var(--viz-justificado)' },
]
export const ESTADO_TIEMPO_MUERTO_LABEL: Record<EstadoTiempoMuerto, string> = {
  sin_justificacion: 'Sin justificación',
  pendiente: 'Por justificar',
  justificado: 'Justificado',
}

export interface TiempoMuertoDetalle {
  usuarioId: string
  nombre: string
  rol: string
  dia: string
  inicio: string
  fin: string
  segundos: number
  estado: EstadoTiempoMuerto
  segundosPendientes: number
  justificacion: {
    id: string
    motivo: MotivoTiempoMuerto
    observacion: string | null
    justificadoPor: string
    justificadoAt: string
  } | null
}

export interface TiemposMuertosPeriodo {
  minimoSegundos: number
  maximoSegundos: number
  /** Hay cuadro de turnos: los huecos van acotados a la jornada. */
  conTurnos: boolean
  resumen: {
    segundos: number
    justificados: number
    sinJustificacion: number
    pendientes: number
    cantidad: number
    cantidadPendientes: number
  }
  personas: {
    id: string
    nombre: string
    rol: string
    segundos: number
    justificados: number
    sinJustificacion: number
    pendientes: number
    cantidad: number
  }[]
  porMotivo: { motivo: MotivoTiempoMuerto; segundos: number }[]
  tramos: TiempoMuertoDetalle[]
}

const fmtHoraBogota = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false,
})

/** "2026-09-10T13:51:00Z" → "08:51", en hora de Bogota. */
export function fmtHora(iso: string): string {
  return fmtHoraBogota.format(new Date(iso))
}

/**
 * Eje de tiempo con marcas que se leen: horas si algo pasa de una hora,
 * minutos si pasa de dos minutos, si no segundos.
 */
export function ejeDeTiempo(maxSegundos: number): { escala: number; formato: (v: number) => string } {
  if (maxSegundos >= 3600) {
    return { escala: 3600, formato: (v) => `${(v / 3600).toLocaleString('es-CO', { maximumFractionDigits: 1 })} h` }
  }
  if (maxSegundos >= 120) return { escala: 60, formato: (v) => `${Math.round(v / 60)} min` }
  return { escala: 1, formato: (v) => `${Math.round(v)} s` }
}
