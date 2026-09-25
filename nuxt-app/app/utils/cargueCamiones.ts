// Cargue de camiones — tipos y ayudas de la pantalla (25-09-2026). Las reglas
// las valida el servidor (server/utils/cargueCamionCalc.ts); aqui van los
// espejos que la pantalla necesita para guiar antes de enviar.

export const API_CARGUE = '/api/cargue-camiones'

export const ROLES_GESTION_CARGUE_UI = ['SUPERVISOR_TRANSPORTE', 'GERENTE', 'ADMIN']
export const esGestionCargueUi = (role: string | null | undefined) => ROLES_GESTION_CARGUE_UI.includes(role ?? '')

export type OrigenOrdenCargue = 'GOURMET' | 'MUEBLES' | 'AMBOS' | 'MANUAL'

export const ORIGEN_CARGUE_LABEL: Record<OrigenOrdenCargue, string> = {
  GOURMET: 'Gourmet',
  MUEBLES: 'Muebles',
  AMBOS: 'Gourmet + Muebles',
  MANUAL: 'Sin registro',
}

export interface OperarioCargue { id: string; nombre: string; activo?: boolean }

export interface OrdenCargue {
  id: string
  codigo: string
  tipoOrden: string
  origen: OrigenOrdenCargue
  tienda: string | null
  cliente: string | null
  ciudad: string | null
  bultosGourmet: number | null
  bultosMuebles: number | null
  bultosDeclarados: number | null
  bultosCargados: number | null
  notaDiferencia: string | null
  m3: number | null
  kg: number | null
  valorOvdm: number | null
  horaInicio: string
  horaFin: string | null
}

export interface CamionCargue {
  id: string
  estado: 'EN_CURSO' | 'CERRADO'
  tipoVehiculo: string
  transportadora: string
  placa: string | null
  observacion: string | null
  fecha: string
  horaInicio: string
  horaFinalizacion: string | null
  creadoPor: { id: string; nombre: string } | null
  cerradoPor: { id: string; nombre: string } | null
  operarios: OperarioCargue[]
  /** Quienes cargan sin estar en la lista (nombre a mano). */
  otrosOperarios: string[]
  ordenes: OrdenCargue[]
}

/** Todas las personas del camion: las de la lista y las escritas a mano. */
export function personasCamion(c: { operarios: OperarioCargue[]; otrosOperarios?: string[] }): string[] {
  return [...c.operarios.map((o) => o.nombre), ...(c.otrosOperarios ?? [])]
}

export interface OrdenEncontradaCargue {
  codigo: string
  tipoOrden: string
  origen: OrigenOrdenCargue
  tienda: string | null
  cliente: string | null
  ciudad: string | null
  bultosGourmet: number | null
  bultosMuebles: number | null
  bultosDeclarados: number | null
  bloqueo: string | null
  yaCargadaEn: { cargueId: string; placa: string | null; fecha: string } | null
}

export interface DatosCamion {
  tipoVehiculo: string
  transportadora: string
  placa: string | null
  observacion: string | null
  operarios: string[]
  otrosOperarios: string[]
  motivo?: string | null
}

/** "ovdm 121 831" → "OVDM121831" (igual que el servidor). */
export function normalizarCodigoCargueUi(v: string): string {
  return v.trim().toUpperCase().replace(/[\s-]+/g, '')
}
export function codigoCargueValido(v: string): boolean {
  return /^(OVDM|TSDM)\d{3,}$/.test(normalizarCodigoCargueUi(v))
}

/** Minutos entre dos instantes (null si falta alguno). */
export function minutosCargue(desde: string | null, hasta: string | null): number | null {
  if (!desde || !hasta) return null
  return Math.max(0, (new Date(hasta).getTime() - new Date(desde).getTime()) / 60_000)
}

export function bultosCamion(c: CamionCargue): number {
  return c.ordenes.reduce((s, o) => s + (o.bultosCargados ?? 0), 0)
}

export function novedadesCamion(c: CamionCargue): number {
  return c.ordenes.filter((o) => o.bultosDeclarados != null && o.bultosCargados != null && o.bultosDeclarados !== o.bultosCargados).length
}

export function fmtHoraCargue(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}
