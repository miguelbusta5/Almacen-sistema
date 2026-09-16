// Tipos y etiquetas de Picking e Inspeccion de Muebles (cliente).
//
// La logica de validacion NO se duplica aqui: el servidor es quien decide, y el
// cliente solo pinta lo que le devuelve. Lo unico que vive aqui son etiquetas,
// tonos y formateo — cosas que no cambian el resultado de nada.

export const API_PICKING = '/api/picking-muebles'
export const API_INSPECCION = '/api/inspeccion-muebles'
export const API_ADMIN_MUEBLES = '/api/muebles-admin'
export const API_INDICADORES_MUEBLES = '/api/indicadores-muebles'

export type EstadoLinea = 'EN_PICKING' | 'PICKEADA' | 'EN_INSPECCION' | 'EN_EBANISTERIA' | 'LISTO'
export type EstadoOrden = 'EN_PICKING' | 'EN_INSPECCION' | 'INSPECCIONADA' | 'ENTREGADA_TRANSPORTE'
export type TipoEquipo = 'ORDER_PICKER' | 'GENIE'

export interface Inspector { id: string; nombre: string; activo?: boolean }

export type OrigenTipoMueble = 'DERIVADO' | 'MANUAL'

export interface TipoPlu {
  plu: string
  tipo: string
  origen: OrigenTipoMueble
  descripcion: string | null
}

/** Una fila de la pantalla de asignacion del dia. */
export interface OperarioDelDia {
  id: string
  nombre: string
  equipo: Equipo | null
}

export interface Equipo {
  id: string
  codigo: string
  tipo: TipoEquipo
  activo: boolean
}

export interface Participante {
  id: string
  nombre: string
  equipo: string | null
  esCreador: boolean
}

export interface Linea {
  id: string
  plu: string
  descripcion: string | null
  partes: number | null
  pesoUnitarioKg: number | null
  volumenUnitarioM3: number | null
  unidades: number
  ubicacion: string | null
  numeroCaja: string | null
  volumenTotalM3: number | null
  pesoTotalKg: number | null
  estado: EstadoLinea
  horaInicio: string
  horaFin: string | null
  duracionPickingMin: number | null
  inspHoraInicio: string | null
  inspHoraFin: string | null
  duracionInspeccionMin: number | null
  ebanisteriaInicio: string | null
  ebanisteriaFin: string | null
  duracionEbanisteriaMin: number | null
  motivoEbanisteria: string | null
  /** Averia: el mueble llego dañado y picking trae otro. */
  averiado: boolean
  motivoAveria: string | null
  esperandoReposicion: boolean
  reposicionInicio: string | null
  reposicionFin: string | null
  /** Almuerzo del inspector corriendo sobre este PLU. */
  almuerzoInicio: string | null
  operario: { id: string; nombre: string } | null
  inspector: Inspector | null
  enviadoEbanisteriaPor: Inspector | null
  recibidoEbanisteriaPor: Inspector | null
}

export interface ResumenOrden {
  total: number
  pickeadas: number
  inspeccionadas: number
  enEbanisteria: number
  pendientesInspeccion: number
  progreso: number
}

export interface Orden {
  id: string
  codigo: string
  tipoOrden: 'OVDM' | 'TSDM' | 'CONTADO'
  estado: EstadoOrden
  fecha: string
  horaInicio: string
  horaPasoInspeccion: string | null
  horaFinInspeccion: string | null
  duracionPickingMin: number | null
  duracionInspeccionMin: number | null
  operario: { id: string; nombre: string } | null
  equipo: Equipo | null
  inspector: Inspector | null
  /** Todos los inspectores que han entrado (una TSDM la revisan varios). */
  inspectores: Array<{ id: string; nombre: string; seUnioAt: string | null }>
  /** Cliente de una factura de contado. */
  cliente: string | null
  /** Ciudad a la que va la orden; con esto agrupa el patinador. */
  ciudadEnvio: string | null
  entregadaTransporteAt: string | null
  entregadaPor: { id: string; nombre: string } | null
  /** Del primer PLU bajado a la entrega a transporte. Null si no ha salido. */
  leadTimeMin: number | null
  /** Almuerzo de la orden: si tiene hora, esta detenida. */
  almuerzoInicio: string | null
  almuerzoSegundos: number
  participantes: Participante[]
  lineas: Linea[]
  resumen: ResumenOrden
  volumen: VolumenOrden
}

/** m3 y kg acumulados por la orden. Sin capacidad: el area no mide los equipos. */
export interface VolumenOrden {
  m3: number
  kg: number
  lineasSinMedida: number
}

export interface Pendiente {
  id: string
  plu: string
  unidades: number
  observacion: string | null
  estado: 'PENDIENTE' | 'ASIGNADO' | 'RESUELTO'
  /** FALTANTE (no estaba) o AVERIA (llego dañado: hay que traer otro). */
  motivo: 'FALTANTE' | 'AVERIA'
  orden: { id: string; codigo: string } | null
  creadoPorInspector: Inspector | null
  asignadoA: { id: string; nombre: string } | null
  resueltoPor: { id: string; nombre: string } | null
  solicitadoAt: string
  horaInicio: string | null
  horaFin: string | null
  duracionMin: number | null
  esperaMin: number | null
}

export const ESTADO_LINEA_LABEL: Record<EstadoLinea, string> = {
  EN_PICKING: 'En picking',
  PICKEADA: 'Por inspeccionar',
  EN_INSPECCION: 'Inspeccionando',
  EN_EBANISTERIA: 'En ebanistería',
  LISTO: 'Listo',
}

export const ESTADO_LINEA_TONE: Record<EstadoLinea, string> = {
  EN_PICKING: 'var(--brand)',
  PICKEADA: 'var(--muted)',
  EN_INSPECCION: 'var(--info, var(--brand))',
  EN_EBANISTERIA: 'var(--u-aviso)',
  LISTO: 'var(--u-ok)',
}

export const ESTADO_ORDEN_LABEL: Record<EstadoOrden, string> = {
  EN_PICKING: 'En picking',
  EN_INSPECCION: 'En inspección',
  // Al quedar inspeccionada ya esta en la bandeja del patinador.
  INSPECCIONADA: 'Lista para entregar a transporte',
  ENTREGADA_TRANSPORTE: 'Entregada a transporte',
}

export const TIPO_EQUIPO_LABEL: Record<TipoEquipo, string> = {
  ORDER_PICKER: 'Order Picker',
  GENIE: 'Genie',
}

export const TIPO_MERCANCIA_LABEL: Record<string, string> = {
  SOFA: 'Sofá',
  SILLA: 'Silla',
  MESA: 'Mesa',
  LUMINARIA: 'Luminaria',
  RECLINABLE: 'Reclinable',
  POLTRONA: 'Poltrona',
  OTRO: 'Otro',
}

/** m³ con 3 decimales: por debajo de eso, un mueble no se distingue de otro. */
export function fmtM3(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${v.toFixed(3)} m³`
}

export function fmtKg(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${v.toFixed(1)} kg`
}

export function fmtMin(v: number | null | undefined): string {
  if (v == null) return '—'
  if (v < 60) return `${v} min`
  return `${Math.floor(v / 60)}h ${v % 60}m`
}

export function fmtHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

/** mm:ss (o hh:mm:ss) de un reloj vivo. Blindado contra horaInicio en el futuro. */
export function cronometro(desde: string | null | undefined, ahora: number): string {
  if (!desde) return '—'
  const ms = Math.max(0, ahora - new Date(desde).getTime())
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/** Mensaje de error de un $fetch de Nitro, que trae el motivo en statusMessage. */
export function mensajeError(e: unknown, fallback = 'No se pudo completar la acción'): string {
  const err = e as { statusMessage?: string; data?: { statusMessage?: string; message?: string } }
  return err?.data?.statusMessage || err?.statusMessage || err?.data?.message || fallback
}
