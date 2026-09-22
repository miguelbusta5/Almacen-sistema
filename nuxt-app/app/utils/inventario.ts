// Conteo cíclico: lo que la pantalla necesita saber del servidor.
//
// El cálculo vive en el servidor (server/utils/inventarioCiclicoCalc.ts). Aquí
// solo están los tipos y lo mínimo para pintar: la regla del cero se comprueba
// con `faltaUnidadEmpaque`, que es el espejo exacto de `fisicoInventario`.

export const API_INVENTARIOS = '/api/inventarios'

export interface RegistroInventario {
  id: string
  plu: string
  cajas: number
  empaque: number
  reguero: number
  fisico: number
  estado: string
  inesperado: boolean
}

export interface EsperadoInventario { plu: string; descripcion: string }

export interface TareaInventarioDTO {
  id: string
  ubicacion: string
  tipo: 'INICIAL' | 'RECONTEO'
  estado: 'PENDIENTE' | 'EN_CURSO' | 'COMPLETADA'
  usuarioId: string | null
  casoId?: string | null
  inicio: string | null
  fin: string | null
  pausaInicio: string | null
  pausaMotivo: string | null
  pausaSegundos: number
  revision: number
  /** Solo en la lista: cuántos PLU lleva contados. */
  _count?: { registros: number }
  /** Solo al abrir una ubicación (tarea.get.ts). */
  registros?: RegistroInventario[]
  esperados?: EsperadoInventario[]
}

export interface CicloResumen {
  id: string
  nombre: string
  estado: string
  createdAt: string
  cronograma: { nombre: string }
  _count: { tareas: number; casos: number }
}

export interface CicloDetalle {
  id: string
  nombre: string
  estado: 'BORRADOR' | 'EN_CONTEO' | 'REVISION' | 'CERRADO'
  tareas: TareaInventarioDTO[]
  /** Todas las ubicaciones que me tocan, livianas: sirven para el escaneo. */
  ubicaciones: Array<{ id: string; ubicacion: string; tipo: string; estado: string; usuarioId: string | null }>
  resumen: { total: number; pendientes: number; enCurso: number; completadas: number }
  paginacion: { page: number; pageSize: number; total: number }
  personas: Array<{ id: string; name: string }>
  casos: any[]
  filas?: any[]
  avisos?: Array<{ plu: string; descripcion: string; ubicaciones?: string[]; motivo?: string }>
  esperadosPorUbicacion?: Record<string, EsperadoInventario[]>
}

/**
 * Lo único que el servidor rechaza de una captura: contar cajas sin decir
 * cuántas unidades trae cada una. Todo en cero es válido (ubicación vacía) y
 * solo reguero también. Espejo de `fisicoInventario`.
 */
export function faltaUnidadEmpaque(cajas: number | null, empaque: number | null): boolean {
  return Number(cajas ?? 0) > 0 && !(Number(empaque ?? 0) > 0)
}

/** Total que se va a guardar, tal como lo calcula el servidor. */
export function fisicoCapturado(cajas: number | null, empaque: number | null, reguero: number | null): number {
  return Number(cajas ?? 0) * Number(empaque ?? 0) + Number(reguero ?? 0)
}

/** "1 h 02 m" del reloj de una ubicación, descontando pausas. */
export function tiempoTarea(t: TareaInventarioDTO, ahora: number): string {
  if (!t.inicio) return 'Sin iniciar'
  const fin = new Date(t.fin ?? t.pausaInicio ?? ahora).getTime()
  const seg = Math.max(0, Math.floor((fin - new Date(t.inicio).getTime()) / 1000 - (t.pausaSegundos ?? 0)))
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} m` : `${m} m ${String(seg % 60).padStart(2, '0')} s`
}

export const ESTADO_TAREA_LABEL: Record<string, string> = {
  PENDIENTE: 'Sin empezar',
  EN_CURSO: 'Contando',
  COMPLETADA: 'Terminada',
}

/** Qué decirle al operario cuando la ubicación escaneada no sirve. */
export const MOTIVO_UBICACION: Record<string, string> = {
  NO_EXISTE: 'Esa ubicación no está en este cíclico',
  AJENA: 'Esa ubicación es de otro operario',
  COMPLETADA: 'Ya terminaste esa ubicación',
}
