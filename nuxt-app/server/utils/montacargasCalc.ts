// Helpers PUROS de Control Montacargas y Resurtido. Port 1:1 de
// src/lib/montacargas.ts — ahi viven los tests, aqui lo consume Nitro. Sin
// Prisma a proposito: mapRow.ts importa de aqui y no debe arrastrar el cliente
// de Prisma al bundle (ver BUG-004 en docs/cerebro/bugs.md). Las dos copias
// deben mantenerse en sync.

export const ROLES_MONTACARGAS = [
  'MONTACARGAS',
  'SUPERVISOR_ALMACENAMIENTO',
  'GERENTE',
  'ADMIN',
] as const

// Quienes ven los registros de todo el mundo y pueden exportar, corregir horas o
// borrar. Un MONTACARGAS solo ve y cierra los suyos.
export const GESTORES_MONTACARGAS = [
  'SUPERVISOR_ALMACENAMIENTO',
  'GERENTE',
  'ADMIN',
] as const

export function puedeUsarMontacargas(role: string | null | undefined): boolean {
  return !!role && (ROLES_MONTACARGAS as readonly string[]).includes(role)
}

export function puedeGestionarMontacargas(role: string | null | undefined): boolean {
  return !!role && (GESTORES_MONTACARGAS as readonly string[]).includes(role)
}

// ── Tipos de registro ────────────────────────────────────────────────
// Los tres comparten tabla y flujo (crear → ubicar). Se diferencian en si la
// mercancía tiene ubicación de origen y en qué módulo se captura.
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

export interface CapturaMontacargas {
  tipo?: unknown
  codigo?: string
  cajas?: number
  unidadesPorCaja?: number
  hayReguero?: boolean
  unidadesSueltas?: number
  ubicacionInicial?: string
}

export function validarCaptura(input: CapturaMontacargas): string | null {
  if (!esTipoMovimiento(input.tipo)) return 'Tipo de registro inválido'
  if (!input.codigo?.trim()) return 'El PLU o código de barras es obligatorio'

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

  if (requiereUbicacionInicial(input.tipo)) {
    const err = validarUbicacion(
      normalizarUbicacion(input.ubicacionInicial),
      'La ubicación inicial',
    )
    if (err) return err
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

export type EstadoMovimiento = 'EN_CURSO' | 'CERRADO'

/** El estado no es una columna: se deriva de si ya se asignó la ubicación final. */
export function estadoMovimiento(
  horaFinalizacion: Date | string | null | undefined,
): EstadoMovimiento {
  return horaFinalizacion ? 'CERRADO' : 'EN_CURSO'
}

export const ESTADO_MOVIMIENTO_LABEL: Record<EstadoMovimiento, string> = {
  EN_CURSO: 'En curso',
  CERRADO: 'Cerrado',
}
