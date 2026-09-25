// Indicadores por proceso (almacenamiento): tipos de /api/indicadores/procesos
// y los formatos de la pantalla. El cálculo vive en server/utils/procesosCalc.ts.

export const API_PROCESOS = '/api/indicadores/procesos'

export type PestanaProceso = 'recepcion' | 'movimientos' | 'pendientes' | 'resurtido' | 'generales'
export const PESTANAS_PROCESO: ReadonlyArray<{ key: PestanaProceso; label: string }> = [
  { key: 'recepcion', label: 'Recepción' },
  { key: 'movimientos', label: 'Movimientos' },
  { key: 'pendientes', label: 'Pendientes' },
  { key: 'resurtido', label: 'Resurtido' },
  { key: 'generales', label: 'Tareas generales' },
]

export interface Cifras { plus: number; unidades: number; m3: number; kg: number }
export type Semaforo = 'verde' | 'amarillo' | 'rojo' | null

export interface ResumenProcesoDTO {
  total: Cifras
  dias: number
  equipoDia: Cifras
  personaDia: Cifras
  sinMedida: number
  personas: Array<{ usuarioId: string; nombre: string; dias: number; total: Cifras; porDia: Cifras; semaforo: Semaforo }>
  serie: Array<{ dia: string } & Cifras>
  topPlus: Array<{ plu: string; descripcion: string | null; veces: number; unidades: number }>
}

export interface ProcesoDTO {
  actual: ResumenProcesoDTO
  anterior: { total: Cifras; dias: number; equipoDia: Cifras; personaDia: Cifras }
  meta: { plus: number; unidades: number } | null
}

export interface GrupoRecepcionDTO {
  clave: string
  contenedores: number
  descargaMin: number
  almacenamientoMin: number | null
  trabajoMin: number | null
  cicloMin: number | null
  personas: number
  unidades: number
  kg: number
  m3: number | null
  conAlmacenamiento: number
}

export interface RespuestaProcesos {
  rango: { desde: string; hasta: string }
  anterior: { desde: string; hasta: string }
  metaVentana: { desde: string; hasta: string }
  recepcion: {
    actual: {
      general: GrupoRecepcionDTO | null
      porProveedor: GrupoRecepcionDTO[]
      porTipo: GrupoRecepcionDTO[]
      porUnidades: GrupoRecepcionDTO[]
      porVolumen: GrupoRecepcionDTO[]
      porPeso: GrupoRecepcionDTO[]
    }
    anterior: GrupoRecepcionDTO | null
  }
  movimientos: ProcesoDTO
  pendientes: ProcesoDTO & { solicitados: Array<{ plu: string; descripcion: string; veces: number; unidades: number }> }
  resurtido: { normal: ProcesoDTO; capacidad: ProcesoDTO; total: ProcesoDTO }
  generales: {
    actual: {
      segundos: number
      dias: number
      equipoDiaSeg: number
      personaDiaSeg: number
      personas: Array<{ usuarioId: string; nombre: string; dias: number; segundos: number; porDiaSeg: number; tareas: number }>
      porDescripcion: Array<{ descripcion: string; veces: number; segundos: number; personas: number }>
      serie: Array<{ dia: string; segundos: number; personas: number }>
    }
    anterior: { segundos: number; dias: number; equipoDiaSeg: number; personaDiaSeg: number }
  }
}

export const SEMAFORO_META_LABEL: Record<'verde' | 'amarillo' | 'rojo', string> = {
  verde: 'En la meta',
  amarillo: 'Cerca (80 %+)',
  rojo: 'Debajo',
}
/** Colores de estado del sistema: el semáforo es un estado, no una serie. */
export const SEMAFORO_META_COLOR: Record<'verde' | 'amarillo' | 'rojo', string> = {
  verde: 'var(--u-ok)',
  amarillo: 'var(--u-aviso)',
  rojo: 'var(--u-critico)',
}

const dec1 = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 1 })
const dec2 = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 2 })
export const fmtCifra = (n: number | null | undefined) => (n == null ? '—' : dec1(n))
export const fmtM3Proceso = (n: number | null | undefined) => (n == null ? '—' : `${dec2(n)} m³`)
export const fmtKgProceso = (n: number | null | undefined) => (n == null ? '—' : `${Math.round(n).toLocaleString('es-CO')} kg`)

/** Minutos o segundos a "2 h 05 min". */
export function fmtDuracion(min: number | null | undefined): string {
  if (min == null) return '—'
  if (min < 1) return `${Math.round(min * 60)} s`
  if (min < 60) return `${Math.round(min)} min`
  const h = Math.floor(min / 60)
  const m = Math.round(min - h * 60)
  return m === 60 ? `${h + 1} h` : `${h} h ${String(m).padStart(2, '0')} min`
}

/**
 * Cambio frente al periodo anterior. `menosEsMejor` para tiempos (una descarga
 * más corta es buena noticia). Sin base no hay comparación.
 */
export function variacion(actual: number | null | undefined, anterior: number | null | undefined, menosEsMejor = false):
  { texto: string; tono: 'bien' | 'mal' | 'igual' } | null {
  if (actual == null || anterior == null || anterior === 0) return null
  const pct = ((actual - anterior) / anterior) * 100
  if (Math.abs(pct) < 1) return { texto: '= periodo anterior', tono: 'igual' }
  const sube = pct > 0
  return {
    texto: `${sube ? '▲' : '▼'} ${dec1(Math.abs(Math.round(pct * 10) / 10))} % vs periodo anterior`,
    tono: sube !== menosEsMejor ? 'bien' : 'mal',
  }
}
