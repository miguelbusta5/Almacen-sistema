// Helpers y DTOs de Control Montacargas y Resurtido. CLIENT-SAFE: sin Prisma ni
// nada de servidor. Port de src/lib/montacargas.ts — mantener en sync con
// nuxt-app/server/utils/montacargasCalc.ts (Nitro y Vue resuelven alias
// distintos, igual que ya pasa con permissions.ts / modulePermissions.ts).
import type { ModuleKey } from './modulePermissions'

export const API_MONTACARGAS = '/api/montacargas'

// ── Tipos de registro ────────────────────────────────────────────────
export type TipoMovimiento = 'RECEPCION' | 'MOVIMIENTO' | 'RESURTIDO'

export const TIPO_MOVIMIENTO_LABEL: Record<TipoMovimiento, string> = {
  RECEPCION: 'Recepción de contenedor',
  MOVIMIENTO: 'Movimiento de depósito',
  RESURTIDO: 'Resurtido',
}

/** ¿Este tipo exige ubicación de origen? La mercancía de contenedor entra sin
 *  ubicación previa; un movimiento y un resurtido salen de algún sitio. */
export function requiereUbicacionInicial(tipo: TipoMovimiento): boolean {
  return tipo !== 'RECEPCION'
}

/** En resurtido el operario baja varios PLUs de una pasada y cada uno corre su
 *  propio reloj; en recepción y movimientos se trabaja una estiba a la vez. */
export function admiteVariosAbiertos(tipo: TipoMovimiento): boolean {
  return tipo === 'RESURTIDO'
}

/** En recepción no hay ubicación de origen que revisar: lo que puede no cuadrar
 *  son las unidades de la estiba. */
export function novedadEsperada(tipo: TipoMovimiento): TipoNovedad {
  return tipo === 'RECEPCION' ? 'UNIDADES' : 'UBICACION_INICIAL'
}

/** Config de cada flujo. Los tres comparten componentes y API; cambian el copy,
 *  el módulo al que pertenecen y si piden ubicación inicial. */
export interface FlujoConfig {
  tipo: TipoMovimiento
  label: string
  /** Texto corto para la pestaña. */
  tab: string
  descripcion: string
  moduleKey: ModuleKey
}

export const FLUJOS: Record<TipoMovimiento, FlujoConfig> = {
  RECEPCION: {
    tipo: 'RECEPCION',
    label: 'Recepción de contenedor',
    tab: 'Recepción',
    descripcion: 'Mercancía que llega en contenedor y aún no tiene ubicación',
    moduleKey: 'control-montacargas',
  },
  MOVIMIENTO: {
    tipo: 'MOVIMIENTO',
    label: 'Movimiento de depósito',
    tab: 'Movimientos',
    descripcion: 'Traslado de mercancía entre ubicaciones del CEDI',
    moduleKey: 'control-montacargas',
  },
  RESURTIDO: {
    tipo: 'RESURTIDO',
    label: 'Resurtido',
    tab: 'Resurtido',
    descripcion: 'Reposición de mercancía desde depósito',
    moduleKey: 'resurtido',
  },
}

// Pestañas del módulo Control Montacargas, en orden.
export const FLUJOS_MONTACARGAS: FlujoConfig[] = [FLUJOS.RECEPCION, FLUJOS.MOVIMIENTO]

// ── Estados y novedades ──────────────────────────────────────────────
export type EstadoMovimiento = 'EN_CURSO' | 'NOVEDAD' | 'CERRADO'

export const ESTADO_MOVIMIENTO_LABEL: Record<EstadoMovimiento, string> = {
  EN_CURSO: 'En curso',
  NOVEDAD: 'Con novedad',
  CERRADO: 'Cerrado',
}

export const ESTADO_MOVIMIENTO_TONE: Record<EstadoMovimiento, string> = {
  EN_CURSO: 'var(--info)',
  NOVEDAD: 'var(--u-aviso)',
  CERRADO: 'var(--u-ok)',
}

export type TipoNovedad = 'UNIDADES' | 'UBICACION_INICIAL'

export const TIPO_NOVEDAD_LABEL: Record<TipoNovedad, string> = {
  UNIDADES: 'Las unidades no coinciden',
  UBICACION_INICIAL: 'La ubicación inicial no coincide',
}

// ── DTOs (forma exacta de mapMovimientoMontacargas en el servidor) ───
export interface TramoMovimiento {
  id: string
  orden: number
  usuarioId: string
  usuarioNombre: string | null
  inicio: string
  fin: string | null
}

export interface NovedadMovimiento {
  id: string
  tipo: TipoNovedad
  detalle: string | null
  cantidadEncontrada: number | null
  ubicacionEncontrada: string | null
  abiertaPorId: string
  abiertaPorNombre: string | null
  abiertaAt: string
  resueltaPorId: string | null
  resueltaPorNombre: string | null
  resueltaAt: string | null
  notaResolucion: string | null
}

export interface Movimiento {
  id: string
  tipo: TipoMovimiento
  estado: EstadoMovimiento
  plu: string
  ean: string | null
  descripcion: string
  cajas: number
  unidadesPorCaja: number
  unidadesManuales: boolean
  hayReguero: boolean
  unidadesSueltas: number
  cantidadTotal: number
  ubicacionInicial: string | null
  ubicacionFinal: string | null
  fecha: string | null
  horaInicio: string
  horaFinalizacion: string | null
  duracionSegundos: number | null
  /** Tramos por persona, EN SEGUNDOS: el montacarguista hasta el traspaso, el
   *  ayudante desde ahi. `segundosAyudante` es null cuando nunca se traspaso.
   *
   *  En segundos porque en resurtido el trabajo dura eso: redondeado al minuto,
   *  un tramo real de 24 s se leia como "0 min". */
  segundosMontacarguista: number
  segundosAyudante: number | null
  motivoCorreccion: string | null
  /** Registro del que salio este sobrante, o null si no lo es. */
  origenId: string | null
  creadoPorId: string
  creadoPorNombre: string | null
  responsableId: string
  responsableNombre: string | null
  actualizadoPorId: string | null
  actualizadoPorNombre: string | null
  tramos: TramoMovimiento[]
  novedades: NovedadMovimiento[]
  novedadAbierta: NovedadMovimiento | null
}

export interface MovimientoConteos {
  registrosHoy: number
  cajasHoy: number
  unidadesHoy: number
  sueltasHoy: number
  enCurso: number
  conNovedad: number
  promedioSeg: number | null
}

export interface Operario { id: string; nombre: string }
/** Quien puede recibir un PLU: operarios de almacenamiento y montacarguistas. */
export interface Ayudante { id: string; nombre: string; rol: string; pendientes: number }

/** Lo que devuelve /api/productos-maestro/buscar. */
export interface ProductoBuscado {
  plu: string
  ean: string | null
  descripcion: string | null
  unidadesPorCaja: number | null
  fabricante: string | null
  marca: string | null
}

// ── Roles ────────────────────────────────────────────────────────────
export const GESTORES_MONTACARGAS = [
  'SUPERVISOR_ALMACENAMIENTO', 'GERENTE', 'ADMIN',
]
export const ROLES_MONTACARGAS = ['MONTACARGAS', ...GESTORES_MONTACARGAS]
export const ROL_AYUDANTE = 'OPERARIO_ALMACENAMIENTO'

export function puedeUsarMontacargas(role: string | null | undefined): boolean {
  return Boolean(role && (ROLES_MONTACARGAS.includes(role) || role === ROL_AYUDANTE))
}

export function puedeGestionarMontacargas(role: string | null | undefined): boolean {
  return Boolean(role && GESTORES_MONTACARGAS.includes(role))
}

/** Solo los montacarguistas (y gestión) inician registros. El ayudante recibe. */
export function puedeCrearMovimiento(role: string | null | undefined): boolean {
  return Boolean(role && ROLES_MONTACARGAS.includes(role))
}

export function esAyudante(role: string | null | undefined): boolean {
  return role === ROL_AYUDANTE
}

// Quien puede RECIBIR un PLU traspasado. Un montacarguista tambien hace de
// ayudante cuando hace falta, asi que entra aqui; gestion no, porque supervisar
// no es almacenar. Es una lista aparte de ROLES_MONTACARGAS a proposito: lo que
// define a un receptor es que almacena mercancia, no que pueda crear registros.
export const ROLES_RECEPTORES = [ROL_AYUDANTE, 'MONTACARGAS']

export function puedeRecibirTraspaso(role: string | null | undefined): boolean {
  return !!role && ROLES_RECEPTORES.includes(role)
}

/**
 * ¿Este registro le llego a esta persona por un traspaso?
 *
 * Por REGISTRO y no por rol: desde que un montacarguista tambien puede recibir,
 * el rol ya no dice en que modo esta. Quien recibe confirma lo que le pasaron y
 * no lo corrige — si no cuadra, abre novedad — y eso vale igual para un operario
 * de almacenamiento que para un montacarguista que esta ayudando.
 */
export function recibioTraspaso(
  movimiento: { creadoPorId: string; responsableId: string },
  usuarioId: string | null | undefined
): boolean {
  return (
    !!usuarioId &&
    movimiento.responsableId === usuarioId &&
    movimiento.creadoPorId !== usuarioId
  )
}

// ── Normalización (espejo de montacargasCalc.ts) ─────────────────────
function normalizarCodigo(value: unknown): string {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, ' ')
}

export function normalizarUbicacion(value: unknown): string {
  return normalizarCodigo(value)
}

export function normalizarCodigoProducto(value: unknown): string {
  return normalizarCodigo(value).replace(/\s/g, '')
}

// Ubicación canónica del CEDI: 05-B-25-03-01 (el pasillo puede llevar dígito: G1).
export const UBICACION_PATTERN = /^\d{2}-[A-Z]\d?-\d{2}-\d{2}-\d{2}$/

/** Las ubicaciones fuera del formato canónico (INSPECCION, MUEBLES, ECUADOR…)
 *  son válidas: el histórico tiene 2.406 valores distintos. Solo se marcan. */
export function esUbicacionCanonica(ubicacion: string): boolean {
  return UBICACION_PATTERN.test(ubicacion)
}

/** Cantidad total: cajas master completas más el reguero. */
export function calcularCantidadTotal(
  cajas: number,
  unidadesPorCaja: number,
  unidadesSueltas = 0,
): number {
  if (!Number.isFinite(cajas) || !Number.isFinite(unidadesPorCaja)) return 0
  const sueltas = Number.isFinite(unidadesSueltas) ? Math.max(0, Math.round(unidadesSueltas)) : 0
  return Math.max(0, Math.round(cajas)) * Math.max(0, Math.round(unidadesPorCaja)) + sueltas
}

/**
 * Reparte una cantidad de unidades en cajas master completas + sueltas.
 *
 * Hace falta al partir un registro: si de 72 unidades el ayudante solo almaceno
 * 30, ese registro pasa a valer 30 y hay que expresarlo como 1 caja de 24 mas 6
 * sueltas, porque `cantidadTotal = cajas * unidadesPorCaja + sueltas` es una
 * invariante de la que dependen los KPIs y el Excel.
 */
export function repartirEnCajas(
  unidades: number,
  unidadesPorCaja: number,
): { cajas: number; unidadesSueltas: number } {
  const u = Math.max(0, Math.round(Number.isFinite(unidades) ? unidades : 0))
  const porCaja = Math.max(0, Math.round(Number.isFinite(unidadesPorCaja) ? unidadesPorCaja : 0))
  // Sin unidades por caja no hay cajas que formar: todo es reguero.
  if (porCaja < 1) return { cajas: 0, unidadesSueltas: u }
  return { cajas: Math.floor(u / porCaja), unidadesSueltas: u % porCaja }
}

/**
 * Valida cuantas unidades dice el ayudante que alcanzo a almacenar.
 *
 * El caso real: la ubicacion no da para toda la estiba. Guarda lo que cabe y el
 * resto vuelve al montacarguista. Cero no se acepta: si no cupo NADA no hay nada
 * que cerrar, y para eso esta el boton de pasarle el PLU a otra persona.
 */
export function validarUnidadesAlmacenadas(
  almacenadas: number,
  total: number,
): string | null {
  if (!Number.isFinite(almacenadas) || !Number.isInteger(almacenadas)) {
    return 'Indica cuantas unidades almacenaste'
  }
  if (almacenadas < 1) {
    return 'Si no almacenaste nada, pasa el PLU en vez de cerrarlo'
  }
  if (almacenadas > total) {
    return `No puedes almacenar mas de las ${total} unidades declaradas`
  }
  return null
}

/** ¿Ya tiene cantidades cargadas? Un registro recién abierto no las tiene: el
 *  reloj arranca con el PLU y las cifras llegan después. */
export function tieneCantidades(m: Movimiento): boolean {
  return m.unidadesPorCaja >= 1 && (m.cajas >= 1 || m.unidadesSueltas >= 1)
}

// ── Formato ──────────────────────────────────────────────────────────
export function fmtHoraMovimiento(iso: string | null): string {
  if (!iso) return 'En curso'
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso))
}

/**
 * Duracion legible a partir de SEGUNDOS.
 *
 * Bajo el minuto se muestran los segundos: en resurtido el trabajo dura eso, y
 * redondear al minuto convertia tramos reales de 14 o 24 segundos en un "0 min"
 * que se leia como que nadie habia hecho nada.
 */
export function fmtTiempo(segundos: number | null): string {
  if (segundos == null) return '—'
  const seg = Math.max(0, Math.round(segundos))
  if (seg < 60) return `${seg} s`
  const min = Math.round(seg / 60)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

export function fmtFechaCorta(fecha: string | null): string {
  if (!fecha) return '—'
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

/** Cronómetro del tramo abierto. Devuelve "m:ss" o null si nadie lo tiene. */
export function cronometroTramo(m: Movimiento, ahora: number): string | null {
  const abierto = m.tramos.find((t) => !t.fin)
  if (!abierto) return null
  const seg = Math.max(0, Math.floor((ahora - new Date(abierto.inicio).getTime()) / 1000))
  return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`
}
