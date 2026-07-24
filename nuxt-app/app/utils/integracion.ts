export type EstadoIntegracion = 'PENDIENTE_AREA2' | 'LISTA_TRANSPORTE' | 'COMPLETADA'
export type Area = 'MUEBLES' | 'GOURMET'
export type TipoDocumento = 'OVDM' | 'TSDM'

export interface PlinItem {
  id: string
  area: string
  plu: string
  descripcion: string | null
  unidades: number
}

export interface Integracion {
  id: string
  numeroDocumento: string
  tipoDocumento: string
  fecha: string
  estado: EstadoIntegracion
  areaIniciadora: string
  numeroCajasArea1: number | null
  numeroCajasArea2: number | null
  creadoPorId: string
  creadoPorNombre: string | null
  completadoPorNombre: string | null
  creadoAt: string
  completadoAt: string | null
  entregadoATransporteAt: string | null
  marcadoCompletadoPorId: string | null
  marcadoCompletadoAt: string | null
  observaciones: string | null
  createdAt: string
  updatedAt: string
  plines: PlinItem[]
}

export const INTEG_ESTADO_LABEL: Record<EstadoIntegracion, string> = {
  PENDIENTE_AREA2: 'Pendiente Área 2',
  LISTA_TRANSPORTE: 'Lista para transporte',
  COMPLETADA: 'Completada',
}

export const INTEG_ESTADO_TONE: Record<EstadoIntegracion, string> = {
  PENDIENTE_AREA2: 'var(--u-aviso)',
  LISTA_TRANSPORTE: 'var(--info)',
  COMPLETADA: 'var(--u-ok)',
}

export function areaContraria(area: string): Area {
  return area === 'MUEBLES' ? 'GOURMET' : 'MUEBLES'
}

export function areaFromRole(role: string): Area | null {
  if (role === 'OPERACIONES_MUEBLES') return 'MUEBLES'
  if (role === 'OPERACIONES_GOURMET') return 'GOURMET'
  return null
}

export function integFmtFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function integFmtFechaHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export interface PluRow { plu: string; descripcion: string; unidades: number }
export function emptyPlu(): PluRow { return { plu: '', descripcion: '', unidades: 1 } }
