// Logica pura de Recepcion de Contenedores para Nitro.
//
// Copia de src/lib/recepcionContenedores.ts (fuente de verdad) — Nitro no puede
// importar de src/lib. Mantener en sync; hay tests que leen los dos archivos.

export const TIPOS_PRODUCTO = ["GOURMET", "MUEBLES"] as const
export type TipoProductoRecepcion = (typeof TIPOS_PRODUCTO)[number]

export const TIPOS_CONTENEDOR = ["CARGA_SUELTA", "PIES_20", "PIES_40"] as const
export type TipoContenedorRecepcion = (typeof TIPOS_CONTENEDOR)[number]

export function esTipoContenedor(v: unknown): v is TipoContenedorRecepcion {
  return typeof v === "string" && (TIPOS_CONTENEDOR as readonly string[]).includes(v)
}

export const TIPO_CONTENEDOR_LABEL: Record<TipoContenedorRecepcion, string> = {
  CARGA_SUELTA: "Carga suelta",
  PIES_20: "20 pies",
  PIES_40: "40 pies",
}

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
  tipoContenedor: unknown
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
  if (!esTipoContenedor(d.tipoContenedor)) return "Elige el tipo de contenedor: carga suelta, 20 o 40 pies"
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

// ── Corrección ───────────────────────────────────────────────────────
/**
 * Corrección de una recepción ya guardada (supervisión o el dueño).
 *
 * Solo se valida lo que llega: los campos ausentes no cambian. El motivo es
 * siempre obligatorio porque estos datos alimentan los indicadores; un cambio
 * sin traza los vuelve imposibles de auditar.
 */
export interface CorreccionRecepcion {
  numeroPedido?: string
  proveedor?: string
  tipoProducto?: unknown
  tipoContenedor?: unknown
  pesoKg?: number
  referenciasEsperadas?: number
  cajas?: number
  unidades?: number
  motivo: string
}

export function validarCorreccionRecepcion(d: CorreccionRecepcion): string | null {
  if (String(d.motivo ?? "").trim().length < 5) return "Escribe el motivo de la corrección (mínimo 5 caracteres)"
  if (d.numeroPedido !== undefined && !normalizarPedido(d.numeroPedido)) return "Escribe el número del pedido"
  if (d.proveedor !== undefined && !normalizarProveedor(d.proveedor)) return "Escribe el nombre del proveedor"
  if (d.tipoProducto !== undefined && !esTipoProducto(d.tipoProducto)) return "Elige si es gourmet o muebles"
  if (d.tipoContenedor !== undefined && !esTipoContenedor(d.tipoContenedor)) {
    return "Elige el tipo de contenedor"
  }
  if (d.pesoKg !== undefined && (!Number.isFinite(d.pesoKg) || d.pesoKg <= 0)) {
    return "El peso del contenedor debe ser mayor que cero"
  }
  if (d.referenciasEsperadas !== undefined && (!Number.isInteger(d.referenciasEsperadas) || d.referenciasEsperadas < 1)) {
    return "Indica cuántas referencias se van a recibir"
  }
  if (d.cajas !== undefined && (!Number.isInteger(d.cajas) || d.cajas < 0)) return "La cantidad de cajas no es válida"
  if (d.unidades !== undefined && (!Number.isInteger(d.unidades) || d.unidades < 1)) {
    return "Indica cuántas unidades trae el contenedor"
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

