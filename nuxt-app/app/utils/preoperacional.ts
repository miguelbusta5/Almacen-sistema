export type ResultadoInspeccion = 'CONFORME' | 'NO_CONFORME' | 'NO_APLICA'
export type EstadoInspeccion = 'APROBADA' | 'APROBADA_CON_OBSERVACIONES' | 'BLOQUEADA'

export interface ChecklistItem { categoria: string; item: string; esCritico: boolean }

export interface FormItem extends ChecklistItem {
  resultado: ResultadoInspeccion
  observacion: string
  fotoUrl: string | null
  uploading?: boolean
}

export interface InspeccionRow {
  id: string
  fecha: string
  kilometraje: number | null
  observaciones: string | null
  estado: EstadoInspeccion
  createdAt: string
  vehiculo: { id: string; placa: string; tipo: string } | null
  conductor: { id: string; nombre: string } | null
  items: Array<{ id: string; categoria: string; item: string; resultado: ResultadoInspeccion; esCritico: boolean; fotoUrl: string | null; observacion: string | null }>
}

export interface ConductorData {
  checklist: ChecklistItem[]
  transportista: { id: string; nombre: string; telefono: string | null } | null
  vehiculo: { id: string; placa: string; tipo: string; estado: string } | null
  inspeccionHoy: InspeccionRow | null
  historial: InspeccionRow[]
}

export interface HistorialRow {
  id: string
  fecha: string
  kilometraje: number | null
  estado: EstadoInspeccion
  conductor: { id: string; nombre: string; telefono: string | null }
  vehiculo: { id: string; placa: string; tipo: string }
  itemsCount: number
  noConformes: number
  criticos: number
}

export interface InspeccionDetalle {
  id: string
  fecha: string
  kilometraje: number | null
  observaciones: string | null
  estado: EstadoInspeccion
  conductor: { id: string; nombre: string; telefono: string | null }
  vehiculo: { id: string; placa: string; tipo: string }
  realizadoPor: { id: string; name: string } | null
  items: Array<{ id: string; categoria: string; item: string; resultado: ResultadoInspeccion; esCritico: boolean; fotoUrl: string | null; observacion: string | null }>
}

export const PREOP_ESTADO_LABEL: Record<EstadoInspeccion, string> = {
  APROBADA: 'Aprobada',
  APROBADA_CON_OBSERVACIONES: 'Con observaciones',
  BLOQUEADA: 'Bloqueada',
}

export const PREOP_ESTADO_TONE: Record<EstadoInspeccion, string> = {
  APROBADA: 'var(--u-ok)',
  APROBADA_CON_OBSERVACIONES: 'var(--u-aviso)',
  BLOQUEADA: 'var(--u-critico)',
}

export const PREOP_RESULTADO_LABEL: Record<ResultadoInspeccion, string> = {
  CONFORME: 'Conforme',
  NO_CONFORME: 'No conforme',
  NO_APLICA: 'No aplica',
}

export function estadoEstimado(items: Array<{ esCritico: boolean; resultado: ResultadoInspeccion }>): EstadoInspeccion {
  if (items.some((i) => i.esCritico && i.resultado === 'NO_CONFORME')) return 'BLOQUEADA'
  if (items.some((i) => i.resultado === 'NO_CONFORME')) return 'APROBADA_CON_OBSERVACIONES'
  return 'APROBADA'
}
