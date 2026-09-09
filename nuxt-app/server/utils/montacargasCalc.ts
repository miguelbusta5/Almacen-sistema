// Helpers PUROS de Control Montacargas y Resurtido. Port 1:1 de
// src/lib/montacargas.ts — ahi viven los tests, aqui lo consume Nitro. Sin
// Prisma a proposito: mapRow.ts importa de aqui y no debe arrastrar el cliente
// de Prisma al bundle (ver BUG-004 en docs/cerebro/bugs.md). Las dos copias
// deben mantenerse en sync.

// Montacarguistas: crean registros y pueden pasarlos a un ayudante.
export const ROLES_MONTACARGAS = [
  'MONTACARGAS',
  'SUPERVISOR_ALMACENAMIENTO',
  'GERENTE',
  'ADMIN',
] as const

// Ayudantes: NO crean registros, solo reciben PLUs, los ubican o abren novedad.
export const ROL_AYUDANTE = 'OPERARIO_ALMACENAMIENTO'

// Quienes ven los registros de todo el mundo y pueden exportar, corregir horas,
// resolver novedades o borrar. Un MONTACARGAS solo ve y cierra los suyos.
export const GESTORES_MONTACARGAS = [
  'SUPERVISOR_ALMACENAMIENTO',
  'GERENTE',
  'ADMIN',
] as const

/** ¿Puede entrar al módulo? Incluye a los ayudantes, que ven su bandeja. */
export function puedeUsarMontacargas(role: string | null | undefined): boolean {
  return (
    !!role &&
    ((ROLES_MONTACARGAS as readonly string[]).includes(role) || role === ROL_AYUDANTE)
  )
}

export function puedeGestionarMontacargas(role: string | null | undefined): boolean {
  return !!role && (GESTORES_MONTACARGAS as readonly string[]).includes(role)
}

/** Solo los montacarguistas (y gestión) inician registros. El ayudante recibe. */
export function puedeCrearMovimiento(role: string | null | undefined): boolean {
  return !!role && (ROLES_MONTACARGAS as readonly string[]).includes(role)
}

export function esAyudante(role: string | null | undefined): boolean {
  return role === ROL_AYUDANTE
}

// Quien puede RECIBIR un PLU traspasado. Un montacarguista tambien hace de
// ayudante cuando hace falta, asi que entra aqui; gestion no, porque supervisar
// no es almacenar. Es una lista aparte de ROLES_MONTACARGAS a proposito: lo que
// define a un receptor es que almacena mercancia, no que pueda crear registros.
export const ROLES_RECEPTORES = [ROL_AYUDANTE, "MONTACARGAS"] as const

export function puedeRecibirTraspaso(role: string | null | undefined): boolean {
  return !!role && (ROLES_RECEPTORES as readonly string[]).includes(role)
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

// ── Tipos de registro ────────────────────────────────────────────────
// Los tres comparten tabla y flujo. Se diferencian en si la mercancía tiene
// ubicación de origen, en qué módulo se captura y en si admiten varios abiertos.
export type TipoMovimiento = 'RECEPCION' | 'MOVIMIENTO' | 'RESURTIDO'

export const TIPOS_MOVIMIENTO: readonly TipoMovimiento[] = [
  'RECEPCION',
  'MOVIMIENTO',
  'RESURTIDO',
] as const

export const TIPO_MOVIMIENTO_LABEL: Record<TipoMovimiento, string> = {
  RECEPCION: 'Recepción de contenedor',
  MOVIMIENTO: 'Movimiento de depósito',
  RESURTIDO: 'Resurtido',
}

export function esTipoMovimiento(value: unknown): value is TipoMovimiento {
  return typeof value === 'string' && (TIPOS_MOVIMIENTO as readonly string[]).includes(value)
}

/**
 * ¿Este tipo exige ubicación de origen?
 *
 * La mercancía de contenedor entra al CEDI sin ubicación previa, así que en
 * RECEPCION no hay de dónde sacarla. En un movimiento de depósito y en un
 * resurtido la mercancía ya estaba guardada en algún sitio, y saber de dónde
 * salió es justamente el dato que da sentido al registro.
 */
export function requiereUbicacionInicial(tipo: TipoMovimiento): boolean {
  return tipo !== 'RECEPCION'
}

/**
 * ¿Se pueden tener varios registros abiertos a la vez?
 *
 * En resurtido sí: el operario baja varios PLUs de una pasada y cada uno corre
 * su propio reloj. En recepción y movimientos se trabaja una estiba a la vez,
 * y permitir varios abiertos solo serviría para dejar relojes olvidados.
 */
export function admiteVariosAbiertos(tipo: TipoMovimiento): boolean {
  return tipo === 'RESURTIDO'
}

// ── Estados ──────────────────────────────────────────────────────────
export type EstadoMovimiento = 'EN_CURSO' | 'NOVEDAD' | 'CERRADO'

export const ESTADO_MOVIMIENTO_LABEL: Record<EstadoMovimiento, string> = {
  EN_CURSO: 'En curso',
  NOVEDAD: 'Con novedad',
  CERRADO: 'Cerrado',
}

// ── Novedades ────────────────────────────────────────────────────────
// El ayudante no corrige cantidades ni ubicaciones: si no cuadran, abre una
// novedad. Qué se verifica depende del tipo de registro.
export type TipoNovedad = 'UNIDADES' | 'UBICACION_INICIAL'

export const TIPO_NOVEDAD_LABEL: Record<TipoNovedad, string> = {
  UNIDADES: 'Las unidades no coinciden',
  UBICACION_INICIAL: 'La ubicación inicial no coincide',
}

/**
 * Qué se verifica cuando el ayudante reporta un descuadre.
 *
 * En recepción lo que puede no cuadrar son las unidades de la estiba (no hay
 * ubicación de origen que revisar). En movimientos y resurtido lo que se revisa
 * primero es de dónde salió la mercancía.
 */
export function novedadEsperada(tipo: TipoMovimiento): TipoNovedad {
  return tipo === 'RECEPCION' ? 'UNIDADES' : 'UBICACION_INICIAL'
}

// ── Normalización de entrada ─────────────────────────────────────────
// El operario captura con guantes desde una tablet o con pistola: todo llega en
// mayúsculas y sin espacios de sobra para que el mismo dato no entre de tres
// formas distintas al histórico.
function normalizarCodigo(value: unknown): string {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, ' ')
}

export function normalizarUbicacion(value: unknown): string {
  return normalizarCodigo(value)
}

/** Código escaneado: PLU o EAN. Se conserva tal cual, en mayúsculas. */
export function normalizarCodigoProducto(value: unknown): string {
  return normalizarCodigo(value).replace(/\s/g, '')
}

/** Un EAN es puramente numérico y largo; un PLU puede ser corto o alfanumérico
 *  ('BONO', 'BONO100'). Sirve para decidir por cuál de los dos buscar primero. */
export function pareceEan(codigo: string): boolean {
  return /^\d{8,20}$/.test(codigo)
}

// ── Validación ───────────────────────────────────────────────────────
// Ubicación canónica del CEDI: bodega-pasillo-módulo-nivel-posición
// (05-B-25-03-01). El pasillo puede llevar dígito (G1).
export const UBICACION_PATTERN = /^\d{2}-[A-Z]\d?-\d{2}-\d{2}-\d{2}$/

/** ¿La ubicación sigue el formato canónico? Las que no (INSPECCION, MUEBLES,
 *  ECUADOR…) son válidas igual — el histórico tiene 2.406 valores distintos y
 *  bloquearlas pararía la operación. Solo se marcan en la UI. */
export function esUbicacionCanonica(ubicacion: string): boolean {
  return UBICACION_PATTERN.test(ubicacion)
}

export function validarUbicacion(ubicacion: string, etiqueta = 'La ubicación final'): string | null {
  if (!ubicacion) return `${etiqueta} es obligatoria`
  if (ubicacion.length > 120) return `${etiqueta} es demasiado larga`
  return null
}

/**
 * Apertura del registro: solo hace falta el PLU y, si el tipo lo pide, de dónde
 * sale la mercancía. Las cantidades llegan después — el reloj ya está corriendo.
 */
export function validarApertura(input: {
  tipo?: unknown
  codigo?: string
  ubicacionInicial?: string
}): string | null {
  if (!esTipoMovimiento(input.tipo)) return 'Tipo de registro inválido'
  if (!input.codigo?.trim()) return 'El PLU o código de barras es obligatorio'
  if (requiereUbicacionInicial(input.tipo)) {
    const err = validarUbicacion(
      normalizarUbicacion(input.ubicacionInicial),
      'La ubicación inicial',
    )
    if (err) return err
  }
  return null
}

export interface CantidadesMontacargas {
  cajas?: number
  unidadesPorCaja?: number
  hayReguero?: boolean
  unidadesSueltas?: number
}

/** Cantidades del registro. Se exigen completas al cerrar, no al abrir. */
export function validarCantidades(input: CantidadesMontacargas): string | null {
  const cajas = input.cajas ?? 0
  if (!Number.isInteger(cajas) || cajas < 0) {
    return 'La cantidad de cajas debe ser un entero mayor o igual a 0'
  }
  if (
    !input.unidadesPorCaja ||
    !Number.isInteger(input.unidadesPorCaja) ||
    input.unidadesPorCaja < 1
  ) {
    return 'Las unidades por caja deben ser un entero mayor a 0'
  }

  const sueltas = input.unidadesSueltas ?? 0
  if (!Number.isInteger(sueltas) || sueltas < 0) {
    return 'Las unidades sueltas deben ser un entero mayor o igual a 0'
  }
  // Marcar reguero y no decir cuántas unidades sueltas hay deja el registro sin
  // el dato que justifica haberlo marcado.
  if (input.hayReguero && sueltas < 1) {
    return 'Indica cuántas unidades sueltas hay, o desmarca el reguero'
  }
  // Sin el check, cualquier cantidad suelta seria un dato huerfano que no
  // aparece en ningun reporte de reguero.
  if (!input.hayReguero && sueltas > 0) {
    return 'Marca el reguero para registrar unidades sueltas'
  }
  // Un registro tiene que mover algo: o cajas completas o unidades sueltas.
  if (cajas < 1 && sueltas < 1) {
    return 'Registra al menos una caja o unidades sueltas'
  }
  return null
}

// ── Cálculo ──────────────────────────────────────────────────────────
/**
 * Cantidad total del registro: las cajas master completas más el reguero.
 * Réplica de la columna CANTIDAD TOTAL de la planilla (CAJAS × UNIDADES X CAJA),
 * extendida con las unidades sueltas que no vienen en caja.
 */
export function calcularCantidadTotal(
  cajas: number,
  unidadesPorCaja: number,
  unidadesSueltas = 0,
): number {
  if (!Number.isFinite(cajas) || !Number.isFinite(unidadesPorCaja)) return 0
  const sueltas = Number.isFinite(unidadesSueltas) ? Math.max(0, Math.round(unidadesSueltas)) : 0
  const enCajas = Math.max(0, Math.round(cajas)) * Math.max(0, Math.round(unidadesPorCaja))
  return enCajas + sueltas
}

export interface TramoLike {
  usuarioId: string
  inicio: Date | string
  fin?: Date | string | null
}

/**
 * Segundos trabajados, sumando solo los tramos cerrados.
 *
 * No es `fin - inicio` del registro: entre medias puede haber una novedad, y
 * verificar no se cronometra. Sumar la ventana completa cargaria a los operarios
 * un tiempo que no estuvieron trabajando.
 *
 * En SEGUNDOS y no en minutos porque en resurtido el trabajo dura eso: se vieron
 * registros reales de 14, 21 y 24 segundos, que redondeados al minuto quedaban
 * en cero y hacian ver como si nadie hubiera trabajado. Se redondea una sola vez,
 * al presentar; los acumulados suman segundos exactos.
 */
export function segundosTrabajados(tramos: readonly TramoLike[], hasta?: Date): number {
  let ms = 0
  for (const t of tramos) {
    const inicio = t.inicio instanceof Date ? t.inicio : new Date(t.inicio)
    const finRaw = t.fin ?? hasta ?? null
    if (!finRaw) continue
    const fin = finRaw instanceof Date ? finRaw : new Date(finRaw)
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) continue
    ms += Math.max(0, fin.getTime() - inicio.getTime())
  }
  return Math.round(ms / 1000)
}

/** Los mismos segundos redondeados a minutos. Todo lo que se acumula deberia
 *  usar los segundos y redondear al final, no ir sumando minutos redondeados. */
export function minutosTrabajados(tramos: readonly TramoLike[], hasta?: Date): number {
  return Math.round(segundosTrabajados(tramos, hasta) / 60)
}

/** Minutos por persona, para medir productividad sin castigar al que recibió. */
export function minutosPorUsuario(tramos: readonly TramoLike[]): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const t of tramos) {
    if (!t.fin) continue
    acc[t.usuarioId] = (acc[t.usuarioId] ?? 0) + minutosTrabajados([t])
  }
  return acc
}

/**
 * Segundos del montacarguista que abrió el registro: sus tramos, no los del resto.
 *
 * El PLU puede pasar de mano en mano, y quien lo abrió deja de ser responsable en
 * cuanto lo traspasa. Cargarle el tiempo del ayudante distorsionaría su
 * productividad, que es justo lo que este modulo mide.
 */
export function segundosDelCreador(tramos: readonly TramoLike[], creadoPorId: string): number {
  return segundosTrabajados(tramos.filter((t) => t.usuarioId === creadoPorId))
}

/** Segundos de quien(es) recibieron el PLU. Suma todos los ayudantes por los que
 *  pasó, porque el ayudante puede volver a pasarlo a otro. */
export function segundosDeAyudantes(tramos: readonly TramoLike[], creadoPorId: string): number {
  return segundosTrabajados(tramos.filter((t) => t.usuarioId !== creadoPorId))
}

/** ¿El registro llegó a pasar por un ayudante? Si no, el segundo tiempo se
 *  muestra vacío en vez de como un cero, que se leería como 'tardó nada'. */
export function huboTraspaso(tramos: readonly TramoLike[], creadoPorId: string): boolean {
  return tramos.some((t) => t.usuarioId !== creadoPorId)
}
