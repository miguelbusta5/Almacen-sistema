// Logica pura de Recepcion de Contenedores para Vue + los DTOs del cliente.
//
// CLIENT-SAFE: sin Prisma ni nada de servidor. Copia de
// src/lib/recepcionContenedores.ts (fuente de verdad) — mantener en sync con
// nuxt-app/server/utils/recepcionCalc.ts.

export const TIPOS_PRODUCTO = ["GOURMET", "MUEBLES"] as const
export type TipoProductoRecepcion = (typeof TIPOS_PRODUCTO)[number]

export const ESTADOS_RECEPCION = ["EN_CURSO", "CERRADO"] as const
export type EstadoRecepcion = (typeof ESTADOS_RECEPCION)[number]

export const TIPOS_NOVEDAD_RECEPCION = [
  "FALTANTE",
  "SOBRANTE",
  "AVERIA",
  "MALTRATADA",
] as const
export type TipoNovedadRecepcion = (typeof TIPOS_NOVEDAD_RECEPCION)[number]

/**
 * Quién lleva la planilla.
 *
 * Los montacarguistas NO abren recepciones aunque sí descarguen: la planilla la
 * lleva siempre la misma figura, y ellos aparecen en la lista de personas
 * descargando (ver DESCARGADORES).
 */
export const ROLES_RECEPCION = [
  "OPERARIO_ALMACENAMIENTO",
  "SUPERVISOR_ALMACENAMIENTO",
  "GERENTE",
  "ADMIN",
] as const

/** Quién puede aparecer en "personas descargando": los que mueven la carga. */
export const ROLES_DESCARGADORES = ["MONTACARGAS", "OPERARIO_ALMACENAMIENTO"] as const

/** Supervisión: ve todas las recepciones, corrige y borra. */
export const GESTORES_RECEPCION = ["SUPERVISOR_ALMACENAMIENTO", "GERENTE", "ADMIN"] as const

export function puedeUsarRecepcion(role: string | null | undefined): boolean {
  return !!role && (ROLES_RECEPCION as readonly string[]).includes(role)
}

export function puedeGestionarRecepcion(role: string | null | undefined): boolean {
  return !!role && (GESTORES_RECEPCION as readonly string[]).includes(role)
}

export function esDescargador(role: string | null | undefined): boolean {
  return !!role && (ROLES_DESCARGADORES as readonly string[]).includes(role)
}

export function esTipoProducto(v: unknown): v is TipoProductoRecepcion {
  return typeof v === "string" && (TIPOS_PRODUCTO as readonly string[]).includes(v)
}

export function esTipoNovedadRecepcion(v: unknown): v is TipoNovedadRecepcion {
  return typeof v === "string" && (TIPOS_NOVEDAD_RECEPCION as readonly string[]).includes(v)
}

export const TIPO_PRODUCTO_LABEL: Record<TipoProductoRecepcion, string> = {
  GOURMET: "Gourmet",
  MUEBLES: "Muebles",
}

export const ESTADO_RECEPCION_LABEL: Record<EstadoRecepcion, string> = {
  EN_CURSO: "En curso",
  CERRADO: "Cerrada",
}

export const TIPO_NOVEDAD_RECEPCION_LABEL: Record<TipoNovedadRecepcion, string> = {
  FALTANTE: "Faltante",
  SOBRANTE: "Sobrante",
  AVERIA: "Avería",
  MALTRATADA: "Mercancía maltratada",
}

/** Los dos tipos que se capturan juntos: en la planilla son una sola casilla. */
export const NOVEDADES_CONTEO = ["FALTANTE", "SOBRANTE"] as const
/** Los que exigen foto: hay que poder ver el daño sin bajar al muelle. */
export const NOVEDADES_CON_FOTO = ["AVERIA", "MALTRATADA"] as const

export function exigeFoto(tipo: TipoNovedadRecepcion): boolean {
  return (NOVEDADES_CON_FOTO as readonly string[]).includes(tipo)
}

// ── Apertura ─────────────────────────────────────────────────────────
export interface AperturaRecepcion {
  numeroPedido: string
  proveedor: string
  tipoProducto: unknown
  pesoKg: number
  referenciasEsperadas: number
  cajas: number
  unidades: number
  descargadores: string[]
}

/** Normaliza el número de pedido igual que el resto del proyecto: mayúsculas y
 *  sin espacios sobrantes, para que PEDDM11887 y "peddm 11887" sean el mismo. */
export function normalizarPedido(valor: unknown): string {
  return String(valor ?? "").trim().toUpperCase().replace(/\s+/g, "")
}

export function normalizarProveedor(valor: unknown): string {
  return String(valor ?? "").trim().replace(/\s+/g, " ")
}

/**
 * Valida lo que se pide ANTES de arrancar el reloj.
 *
 * Se exige todo de golpe porque el cronómetro empieza en cuanto se guarda: abrir
 * una planilla a medias dejaría un tiempo corriendo sobre datos que nadie puede
 * interpretar después.
 */
export function validarApertura(d: AperturaRecepcion): string | null {
  if (!normalizarPedido(d.numeroPedido)) return "Escribe el número del pedido"
  if (!normalizarProveedor(d.proveedor)) return "Escribe el nombre del proveedor"
  if (!esTipoProducto(d.tipoProducto)) return "Elige si es gourmet o muebles"
  if (!Number.isFinite(d.pesoKg) || d.pesoKg <= 0) return "El peso del contenedor debe ser mayor que cero"
  if (!Number.isInteger(d.referenciasEsperadas) || d.referenciasEsperadas < 1) {
    return "Indica cuántas referencias se van a recibir"
  }
  if (!Number.isInteger(d.cajas) || d.cajas < 0) return "La cantidad de cajas no es válida"
  if (!Number.isInteger(d.unidades) || d.unidades < 1) return "Indica cuántas unidades trae el contenedor"
  if (!Array.isArray(d.descargadores) || d.descargadores.length === 0) {
    return "Selecciona al menos una persona descargando"
  }
  return null
}

// ── Cierre ───────────────────────────────────────────────────────────
export interface CierreRecepcion {
  estibasUsadas: number
  referenciasNuevas: number
  unidadesNuevas: number
}

export function validarCierre(d: CierreRecepcion): string | null {
  if (!Number.isInteger(d.estibasUsadas) || d.estibasUsadas < 1) {
    return "Indica cuántas estibas se usaron"
  }
  if (!Number.isInteger(d.referenciasNuevas) || d.referenciasNuevas < 0) {
    return "La cantidad de referencias nuevas no es válida"
  }
  if (!Number.isInteger(d.unidadesNuevas) || d.unidadesNuevas < 0) {
    return "La cantidad de unidades nuevas no es válida"
  }
  // Sin referencias nuevas no puede haber unidades nuevas, y al revés: son la
  // misma cifra contada de dos formas y descuadradas no significan nada.
  if (d.referenciasNuevas === 0 && d.unidadesNuevas > 0) {
    return "Hay unidades nuevas pero ninguna referencia nueva"
  }
  if (d.referenciasNuevas > 0 && d.unidadesNuevas === 0) {
    return "Hay referencias nuevas pero ninguna unidad"
  }
  return null
}

// ── Novedades ────────────────────────────────────────────────────────
export interface LineaNovedad {
  plu: string
  descripcion: string
  cantidad: number
  fotoUrl?: string | null
}

export function validarLineaNovedad(
  linea: LineaNovedad,
  tipo: TipoNovedadRecepcion,
): string | null {
  if (!linea.plu?.trim()) return "Falta el PLU"
  if (!linea.descripcion?.trim()) return "El PLU no existe en el maestro"
  if (!Number.isInteger(linea.cantidad) || linea.cantidad < 1) {
    return "La cantidad debe ser al menos 1"
  }
  // La foto es la prueba: un reporte de avería sin foto no sirve para reclamarle
  // al proveedor, que es justo para lo que se levanta.
  if (exigeFoto(tipo) && !linea.fotoUrl) return "Adjunta la foto de la novedad"
  return null
}

// ── Tiempo ───────────────────────────────────────────────────────────
/**
 * Segundos que tomó la recepción.
 *
 * En segundos y no en minutos por lo mismo que en Control Montacargas: se
 * redondea una sola vez, al presentar, y los acumulados suman segundos exactos.
 * A diferencia de allí no hay tramos: una recepción es un solo bloque continuo.
 */
export function segundosRecepcion(
  horaInicio: Date | string,
  horaFinalizacion: Date | string | null | undefined,
  ahora?: Date,
): number | null {
  const ini = horaInicio instanceof Date ? horaInicio : new Date(horaInicio)
  const finRaw = horaFinalizacion ?? ahora ?? null
  if (!finRaw) return null
  const fin = finRaw instanceof Date ? finRaw : new Date(finRaw)
  if (Number.isNaN(ini.getTime()) || Number.isNaN(fin.getTime())) return null
  return Math.max(0, Math.round((fin.getTime() - ini.getTime()) / 1000))
}

/** Unidades por hora: la cifra con la que se compara una descarga con otra. */
export function unidadesPorHora(unidades: number, segundos: number | null): number | null {
  if (!segundos || segundos <= 0 || !Number.isFinite(unidades)) return null
  return Math.round((unidades / segundos) * 3600)
}

// ── DTOs que devuelve la API ─────────────────────────────────────────
export const API_RECEPCION = '/api/recepcion-contenedores'

export interface DescargadorRecepcion {
  id: string
  nombre: string
}

export interface NovedadRecepcionDTO {
  id: string
  tipo: TipoNovedadRecepcion
  plu: string
  descripcion: string
  cantidad: number
  fotoUrl: string | null
  observacion: string | null
  creadoPorNombre: string | null
  createdAt: string
}

export interface Recepcion {
  id: string
  estado: EstadoRecepcion
  numeroPedido: string
  proveedor: string
  tipoProducto: TipoProductoRecepcion
  pesoKg: number
  referenciasEsperadas: number
  cajas: number
  unidades: number
  estibasUsadas: number | null
  referenciasNuevas: number | null
  unidadesNuevas: number | null
  fecha: string | null
  horaInicio: string
  horaFinalizacion: string | null
  /** Null mientras esta abierta: el reloj sigue corriendo. */
  duracionSegundos: number | null
  motivoCorreccion: string | null
  creadoPorId: string
  creadoPorNombre: string | null
  descargadores: DescargadorRecepcion[]
  novedades: NovedadRecepcionDTO[]
}

export interface RecepcionConteos {
  recepcionesHoy: number
  enCurso: number
  unidadesHoy: number
  cajasHoy: number
  estibasHoy: number
  conNovedad: number
  promedioSeg: number | null
}

// ── Presentacion ─────────────────────────────────────────────────────
/**
 * Duracion legible a partir de SEGUNDOS.
 *
 * Misma regla que en Control Montacargas: por debajo del minuto se muestran los
 * segundos, para que un trabajo corto no se lea como un cero.
 */
export function fmtTiempoRecepcion(segundos: number | null): string {
  if (segundos == null) return '—'
  const seg = Math.max(0, Math.round(segundos))
  if (seg < 60) return `${seg} s`
  const min = Math.round(seg / 60)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/** Cronometro de una recepcion abierta. Devuelve "h:mm:ss" o "m:ss". */
export function cronometroRecepcion(r: Recepcion, ahora: number): string | null {
  if (r.horaFinalizacion) return null
  const seg = Math.max(0, Math.floor((ahora - new Date(r.horaInicio).getTime()) / 1000))
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  const s = seg % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

export function fmtFechaRecepcion(fecha: string | null): string {
  if (!fecha) return '—'
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

export function fmtHoraRecepcion(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: 'numeric', minute: '2-digit',
  })
}
