// Logica pura de Picking e Inspeccion de Muebles.
//
// Copia de src/lib/pickingMuebles.ts (fuente de verdad): Nitro no puede importar
// de src/lib. Mantener en sync; hay un guard en src/__tests__/mueblesNuxt.test.ts
// que compara los dos archivos.

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

export function derivarTipoOrden(orden: string): 'OVDM' | 'TSDM' | 'CONTADO' {
  const codigo = normalizarCodigoOrden(orden)
  if (codigo.startsWith('CONTADO')) return 'CONTADO'
  return codigo.startsWith('TSDM') ? 'TSDM' : 'OVDM'
}

/** Codigo de una orden de contado: la factura con la que llega la mercancia. */
export function codigoContado(factura: unknown): string {
  return `CONTADO-${normalizarCodigoOrden(factura)}`
}

export function validarFacturaContado(value: unknown): string | null {
  const f = normalizarCodigoOrden(value)
  if (!f) return 'Escribe el numero de la factura'
  if (f.length > 30) return 'El numero de factura es demasiado largo'
  return null
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
 * El rotulo se guarda tal cual lo lee la pistola: hoy son codigos tipo 'M123134',
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
  reposicionInicio?: Date | string | null
  reposicionFin?: Date | string | null
  inspPausaSegundos?: number | null
}): number | null {
  const bruta = duracionMinutos(linea.inspHoraInicio, linea.inspHoraFin)
  if (bruta == null) return null
  const enTaller = duracionMinutos(linea.ebanisteriaInicio, linea.ebanisteriaFin) ?? 0
  // Esperar el repuesto de un PLU averiado tampoco es inspeccionar, igual que
  // estar en el taller. Y el almuerzo del inspector menos.
  const enReposicion = duracionMinutos(linea.reposicionInicio, linea.reposicionFin) ?? 0
  const almuerzo = (linea.inspPausaSegundos ?? 0) / 60
  return Math.max(0, bruta - enTaller - enReposicion - almuerzo)
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

// ── Volumen de la orden ─────────────────────────────────────────────────────

export interface VolumenOrden {
  m3: number
  kg: number
  /** Cuantas lineas de las contadas no tenian medida en el maestro. */
  lineasSinMedida: number
}

/**
 * m3 y kg acumulados por la orden. Solo cuenta las lineas ya cerradas: una
 * linea abierta todavia no tiene unidades, asi que su total no significa nada.
 *
 * No hay capacidad contra la que comparar: el area decidio no medir cuanto cabe
 * en el Order Picker ni en el Genie. Lo que interesa es el volumen que mueve
 * cada orden, que se sostiene solo como cifra.
 */
export function volumenOrden(
  lineas: Array<{ volumenTotalM3?: number | null; pesoTotalKg?: number | null; horaFin?: Date | string | null }>,
): VolumenOrden {
  let m3 = 0
  let kg = 0
  let lineasSinMedida = 0

  for (const linea of lineas) {
    if (linea.horaFin == null) continue
    if (linea.volumenTotalM3 == null) lineasSinMedida += 1
    else m3 += linea.volumenTotalM3
    if (linea.pesoTotalKg != null) kg += linea.pesoTotalKg
  }

  return { m3: redondear(m3, 6), kg: redondear(kg, 3), lineasSinMedida }
}

// ── Tipo de mercancia ───────────────────────────────────────────────────────

export const TIPOS_MERCANCIA_MUEBLE = [
  'SOFA', 'SILLA', 'MESA', 'LUMINARIA', 'RECLINABLE', 'POLTRONA', 'OTRO',
] as const
export type TipoMercanciaMueble = (typeof TIPOS_MERCANCIA_MUEBLE)[number]

export const TIPO_MERCANCIA_LABEL: Record<TipoMercanciaMueble, string> = {
  SOFA: 'Sofa',
  SILLA: 'Silla',
  MESA: 'Mesa',
  LUMINARIA: 'Luminaria',
  RECLINABLE: 'Reclinable',
  POLTRONA: 'Poltrona',
  OTRO: 'Otro',
}

/**
 * Reglas de clasificacion por palabra clave. EL ORDEN IMPORTA y es la mitad de
 * la logica: un 'SOFA RECLINABLE 3P' es un reclinable, no un sofa, asi que
 * RECLINABLE tiene que evaluarse antes que SOFA. Lo mismo con POLTRONA/BUTACA
 * frente a SILLA.
 *
 * Se comparan sin tildes y en mayusculas porque el maestro las escribe de las
 * dos formas.
 */
const REGLAS_TIPO: ReadonlyArray<readonly [TipoMercanciaMueble, readonly string[]]> = [
  ['RECLINABLE', ['RECLINABLE', 'RECLINER']],
  ['POLTRONA', ['POLTRONA', 'BUTACA', 'BERGERE']],
  ['SOFA', ['SOFA', 'SOFACAMA', 'SECCIONAL', 'CHAISE', 'DIVAN']],
  ['LUMINARIA', ['LUMINARIA', 'LAMPARA', 'BOMBILLO', 'APLIQUE', 'PLAFON', 'CANDELABRO', 'FAROL']],
  // SILLA antes que MESA: 'COMEDOR' nombra la habitacion, no el mueble, asi que
  // una 'SILLA COMEDOR' caia en MESA. Lo que no trae SILLA ni SOFA y si COMEDOR
  // (un 'COMEDOR 6 PUESTOS') si es la mesa del juego.
  ['SILLA', ['SILLA', 'BANCA', 'TABURETE', 'ASIENTO']],
  ['MESA', ['MESA', 'COMEDOR', 'ESCRITORIO', 'NOCHERO', 'CONSOLA', 'AUXILIAR']],
]

function sinTildes(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
}

/**
 * Deduce el tipo de mueble de la descripcion del maestro, que hoy es el unico
 * sitio donde ese dato existe. Se equivocara: por eso el tipo se guarda y el
 * ADMIN puede corregirlo, y una correccion manual ya no se vuelve a pisar.
 */
export function clasificarPorDescripcion(descripcion: string | null | undefined): TipoMercanciaMueble {
  if (!descripcion) return 'OTRO'
  const texto = sinTildes(descripcion)
  for (const [tipo, palabras] of REGLAS_TIPO) {
    if (palabras.some((p) => texto.includes(p))) return tipo
  }
  return 'OTRO'
}

// ── Quien cierra una orden compartida ───────────────────────────────────────

export interface Participante {
  usuarioId: string
  esCreador: boolean
  /** ISO o Date. Ordena quien entro despues. */
  seUnioAt: string | Date
}

/**
 * La pasa a inspeccion EL ULTIMO QUE SE UNIO: si hubo reasignacion, es el que
 * termina el trabajo. El creador solo cuando no hay nadie mas.
 *
 * Gestion puede siempre, y por una razon concreta: si el que se unio sale de
 * turno, la orden se quedaria abierta toda la noche con el reloj corriendo. Ese
 * cierre se audita aparte para que no se confunda con el normal.
 */
export function quienCierra(participantes: readonly Participante[]): string | null {
  if (participantes.length === 0) return null
  const ordenados = [...participantes].sort(
    (a, b) => new Date(a.seUnioAt).getTime() - new Date(b.seUnioAt).getTime(),
  )
  return ordenados[ordenados.length - 1]!.usuarioId
}

export function puedeCerrarOrden(
  participantes: readonly Participante[],
  usuarioId: string,
  role: string | null | undefined,
): boolean {
  return esGestionMuebles(role) || quienCierra(participantes) === usuarioId
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

/**
 * Las lineas que se pasan son SOLO las de quien escanea, no las de toda la orden:
 * una orden puede tener dos operarios y que el compañero tenga un PLU en curso no
 * puede bloquearte. El duplicado si se comprueba contra la orden entera, porque
 * el PLU es unico por orden.
 */
export function validarAgregarPlu(
  lineasDeLaOrden: Array<{ plu: string; estado: EstadoLinea; operarioId?: string | null }>,
  plu: string,
  operarioId?: string | null,
): string | null {
  const mias = operarioId == null
    ? lineasDeLaOrden
    : lineasDeLaOrden.filter((l) => l.operarioId === operarioId)
  if (mias.some((l) => l.estado === 'EN_PICKING')) {
    return 'Ya tienes un PLU en curso: terminalo antes de escanear el siguiente'
  }
  if (lineasDeLaOrden.some((l) => l.plu === plu)) {
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
