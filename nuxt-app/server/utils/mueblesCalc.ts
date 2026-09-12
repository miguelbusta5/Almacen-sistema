// Logica pura de Picking e Inspeccion de Muebles.
//
// Sin Prisma ni h3 a proposito: es lo que testean los tests de vitest, y lo que
// importan tanto los handlers como mapRow.ts. Mismo criterio que
// exportacionesCalc.ts y resurtidoCalc.ts.

export const ROL_PICKING = 'PICKING_MUEBLES'
export const ROL_INSPECCION = 'INSPECCION_MUEBLES'
export const ROLES_GESTION_MUEBLES = ['SUPERVISOR_ALMACENAMIENTO', 'GERENTE', 'ADMIN'] as const

export type EstadoLinea = 'EN_PICKING' | 'PICKEADA' | 'EN_INSPECCION' | 'EN_EBANISTERIA' | 'LISTO'
export type EstadoOrden = 'EN_PICKING' | 'EN_INSPECCION' | 'INSPECCIONADA'

export function puedePickear(role: string | null | undefined): boolean {
  return role === ROL_PICKING || (ROLES_GESTION_MUEBLES as readonly string[]).includes(role ?? '')
}

export function puedeInspeccionar(role: string | null | undefined): boolean {
  return role === ROL_INSPECCION || (ROLES_GESTION_MUEBLES as readonly string[]).includes(role ?? '')
}

export function esGestionMuebles(role: string | null | undefined): boolean {
  return (ROLES_GESTION_MUEBLES as readonly string[]).includes(role ?? '')
}

/**
 * Codigo de orden de NetSuite. Mismo criterio que src/lib/gourmetTipoOrden.ts:
 * el usuario escribe solo la orden y el tipo sale del prefijo.
 */
export function normalizarCodigoOrden(value: unknown): string {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, '')
}

export function derivarTipoOrden(orden: string): 'OVDM' | 'TSDM' {
  return normalizarCodigoOrden(orden).startsWith('TSDM') ? 'TSDM' : 'OVDM'
}

/**
 * Exige el prefijo. A diferencia de Gourmet —que acepta cualquier texto y cae a
 * OVDM— aqui el codigo es la llave unica del modulo: una orden mal escrita crea
 * una orden fantasma que despues nadie encuentra en NetSuite.
 */
export function validarCodigoOrden(value: unknown): string | null {
  const codigo = normalizarCodigoOrden(value)
  if (!codigo) return 'Escribe el numero de la orden'
  if (!/^(TSDM|OVDM)[-]?\d{3,}$/.test(codigo)) {
    return 'La orden debe empezar por TSDM u OVDM seguido de numeros (ej. TSDM123456)'
  }
  return null
}

/**
 * El rotulo se guarda tal cual lo lee la pistola: hoy son codigos tipo "M123134",
 * pero el formato no esta cerrado y bloquear al operario frente a la estanteria
 * por un patron que aun no conocemos cuesta mas de lo que evita.
 */
export function normalizarRotulo(value: unknown): string {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, '')
}

// ── Duraciones ──────────────────────────────────────────────────────────────
// Ninguna se persiste: se calculan, igual que en Exportaciones. Persistirlas
// obligaria a recalcular cada fila cuando se corrige una hora.

export function duracionMinutos(
  inicio: Date | string | null | undefined,
  fin: Date | string | null | undefined,
): number | null {
  if (!inicio || !fin) return null
  const a = inicio instanceof Date ? inicio : new Date(inicio)
  const b = fin instanceof Date ? fin : new Date(fin)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000))
}

/**
 * Tiempo que el inspector realmente dedico al PLU: descuenta la ventana de
 * ebanisteria. Mientras el mueble esta en el taller nadie lo esta inspeccionando,
 * y cargarle ese rato al inspector distorsiona su productividad — mismo criterio
 * que la ventana de novedad en montacargas, que tampoco se cronometra.
 */
export function duracionInspeccionNetaMinutos(linea: {
  inspHoraInicio?: Date | string | null
  inspHoraFin?: Date | string | null
  ebanisteriaInicio?: Date | string | null
  ebanisteriaFin?: Date | string | null
}): number | null {
  const bruta = duracionMinutos(linea.inspHoraInicio, linea.inspHoraFin)
  if (bruta == null) return null
  const enTaller = duracionMinutos(linea.ebanisteriaInicio, linea.ebanisteriaFin) ?? 0
  return Math.max(0, bruta - enTaller)
}

// ── Totales de linea ────────────────────────────────────────────────────────

export interface TotalesLinea {
  volumenTotalM3: number | null
  pesoTotalKg: number | null
}

/**
 * Se sellan al cerrar la linea. Nulos cuando el maestro no trae la medida: el
 * modulo debe dejar trabajar aunque el PLU no este medido todavia, y un cero
 * mentiria diciendo que el mueble no ocupa nada.
 */
export function totalesLinea(
  unidades: number,
  volumenUnitarioM3: number | null | undefined,
  pesoUnitarioKg: number | null | undefined,
): TotalesLinea {
  const n = Number.isFinite(unidades) ? Math.max(0, Math.trunc(unidades)) : 0
  return {
    volumenTotalM3: volumenUnitarioM3 == null ? null : redondear(volumenUnitarioM3 * n, 6),
    pesoTotalKg: pesoUnitarioKg == null ? null : redondear(pesoUnitarioKg * n, 3),
  }
}

function redondear(valor: number, decimales: number): number {
  const f = 10 ** decimales
  return Math.round(valor * f) / f
}

// ── Capacidad del equipo ────────────────────────────────────────────────────

export interface CapacidadEquipo {
  ocupadoM3: number
  pesoKg: number
  capacidadM3: number | null
  /** Null cuando el equipo aun no esta medido: se muestran los m3 sin el %. */
  porcentaje: number | null
  /** Cuantas lineas de las contadas no tenian medida en el maestro. */
  lineasSinMedida: number
  tono: 'ok' | 'aviso' | 'critico'
}

export const UMBRAL_AVISO = 80
export const UMBRAL_CRITICO = 100

/**
 * Carga acumulada en el equipo. Solo cuenta las lineas ya cerradas de la orden
 * abierta: al pasar la orden a inspeccion el operario descarga, asi que la
 * capacidad vuelve a cero sin necesidad de un campo que resetear.
 */
export function capacidadEquipo(
  lineas: Array<{ volumenTotalM3?: number | null; pesoTotalKg?: number | null; horaFin?: Date | string | null }>,
  capacidadM3: number | null | undefined,
): CapacidadEquipo {
  const cerradas = lineas.filter((l) => l.horaFin != null)
  let ocupadoM3 = 0
  let pesoKg = 0
  let lineasSinMedida = 0

  for (const linea of cerradas) {
    if (linea.volumenTotalM3 == null) lineasSinMedida += 1
    else ocupadoM3 += linea.volumenTotalM3
    if (linea.pesoTotalKg != null) pesoKg += linea.pesoTotalKg
  }

  ocupadoM3 = redondear(ocupadoM3, 6)
  pesoKg = redondear(pesoKg, 3)

  const cap = capacidadM3 != null && capacidadM3 > 0 ? capacidadM3 : null
  const porcentaje = cap == null ? null : redondear((ocupadoM3 / cap) * 100, 1)

  let tono: CapacidadEquipo['tono'] = 'ok'
  if (porcentaje != null) {
    if (porcentaje >= UMBRAL_CRITICO) tono = 'critico'
    else if (porcentaje >= UMBRAL_AVISO) tono = 'aviso'
  }

  return { ocupadoM3, pesoKg, capacidadM3: cap, porcentaje, lineasSinMedida, tono }
}

// ── Transiciones ────────────────────────────────────────────────────────────

/**
 * La orden no pasa a inspeccion con un PLU a medias: ese reloj quedaria abierto
 * para siempre y el tiempo del PLU seria basura.
 */
export function validarPasoAInspeccion(lineas: Array<{ estado: EstadoLinea }>): string | null {
  if (lineas.length === 0) return 'Agrega al menos un PLU antes de pasar la orden a inspeccion'
  if (lineas.some((l) => l.estado === 'EN_PICKING')) {
    return 'Termina el PLU en curso antes de pasar la orden a inspeccion'
  }
  return null
}

/** La orden cierra cuando no queda ningun PLU por inspeccionar ni en el taller. */
export function ordenInspeccionCompleta(lineas: Array<{ estado: EstadoLinea }>): boolean {
  return lineas.length > 0 && lineas.every((l) => l.estado === 'LISTO')
}

export function validarAgregarPlu(
  lineas: Array<{ plu: string; estado: EstadoLinea }>,
  plu: string,
): string | null {
  if (lineas.some((l) => l.estado === 'EN_PICKING')) {
    return 'Ya tienes un PLU en curso: terminalo antes de escanear el siguiente'
  }
  if (lineas.some((l) => l.plu === plu)) {
    return `El PLU ${plu} ya esta en esta orden`
  }
  return null
}

export interface ResumenOrden {
  total: number
  pickeadas: number
  inspeccionadas: number
  enEbanisteria: number
  pendientesInspeccion: number
  progreso: number
}

export function resumenOrden(lineas: Array<{ estado: EstadoLinea }>): ResumenOrden {
  const total = lineas.length
  const listos = lineas.filter((l) => l.estado === 'LISTO').length
  return {
    total,
    pickeadas: lineas.filter((l) => l.estado !== 'EN_PICKING').length,
    inspeccionadas: listos,
    enEbanisteria: lineas.filter((l) => l.estado === 'EN_EBANISTERIA').length,
    pendientesInspeccion: lineas.filter((l) => l.estado === 'PICKEADA' || l.estado === 'EN_INSPECCION').length,
    progreso: total === 0 ? 0 : Math.round((listos / total) * 100),
  }
}
