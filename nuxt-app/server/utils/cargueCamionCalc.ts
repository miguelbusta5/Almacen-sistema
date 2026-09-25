// Cargue de camiones — reglas puras (25-09-2026). Sin base de datos: las usa el
// servidor y las prueban los tests.
//
// El flujo, como Recepcion de contenedores pero de salida:
//   iniciar el camion (tipo, transportadora, placa, quienes cargan) → reloj
//   → por cada orden: agregarla (arranca su reloj) → contar bultos → finalizarla
//   → finalizar el camion cuando no queden ordenes.

/** Quienes operan el cargue (espejo de MODULE_ACCESS['cargue-camiones']). */
export const ROLES_CARGUE_CAMIONES = ['TRANSPORTE', 'SUPERVISOR_TRANSPORTE', 'GERENTE', 'ADMIN'] as const
/** Supervision: corrige y borra camiones. */
export const ROLES_GESTION_CARGUE = ['SUPERVISOR_TRANSPORTE', 'GERENTE', 'ADMIN'] as const

export function puedeCargarCamiones(role: string | null | undefined): boolean {
  return (ROLES_CARGUE_CAMIONES as readonly string[]).includes(role ?? '')
}
export function esGestionCargue(role: string | null | undefined): boolean {
  return (ROLES_GESTION_CARGUE as readonly string[]).includes(role ?? '')
}

const limpio = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim()

/** "ovdm 121 831" → "OVDM121831". */
export function normalizarCodigoCargue(v: unknown): string {
  return limpio(v).toUpperCase().replace(/[\s-]+/g, '')
}

export function tipoOrdenCargue(codigo: string): 'OVDM' | 'TSDM' | 'OTRA' {
  if (codigo.startsWith('OVDM')) return 'OVDM'
  if (codigo.startsWith('TSDM')) return 'TSDM'
  return 'OTRA'
}

export function validarCodigoCargue(v: unknown): string | null {
  const c = normalizarCodigoCargue(v)
  if (!c) return 'Escribe el numero de la orden'
  if (!/^(OVDM|TSDM)\d{3,}$/.test(c)) return 'La orden debe ser OVDM o TSDM seguida de numeros (ej. OVDM121831)'
  return null
}

export function validarInicioCamion(d: {
  tipoVehiculo: string
  transportadora: string
  placa?: string | null
  operarios: readonly string[]
  /** Quienes cargan y no estan en el catalogo (nombre a mano). */
  otros?: readonly string[]
}): string | null {
  if (!limpio(d.tipoVehiculo)) return 'Escribe el tipo de vehiculo'
  if (!limpio(d.transportadora)) return 'Escribe la transportadora'
  if (d.placa && limpio(d.placa).length > 20) return 'La placa es muy larga'
  if (!d.operarios.length && !d.otros?.length) return 'Elige al menos una persona que cargue el camion'
  return null
}

/** Texto libre en mayusculas y sin espacios de sobra (para agrupar en indicadores). */
export function normalizarTextoCargue(v: unknown): string {
  return limpio(v).toUpperCase()
}

/**
 * "Otra persona": quien carga el camion sin estar en el catalogo. Nombre a mano,
 * en mayusculas, sin vacios ni repetidos (25-09).
 */
export function normalizarOtrosOperarios(v: readonly unknown[] | null | undefined): string[] {
  const out: string[] = []
  for (const x of v ?? []) {
    const n = normalizarTextoCargue(x).slice(0, 80)
    if (n.length >= 3 && !out.includes(n)) out.push(n)
  }
  return out
}

export function normalizarPlaca(v: unknown): string | null {
  const p = limpio(v).toUpperCase().replace(/[\s-]+/g, '')
  return p || null
}

// ── Ordenes que se pueden subir ─────────────────────────────────────

/**
 * Cargue Gourmet: el pedido ya tiene ubicacion (esta listo en bodega) o ya
 * paso por su propio cargue. En la practica los pedidos listos se quedan en
 * UBICACION_ASIGNADA (el estado «enviado a transporte» casi no se usa: el
 * 25-09 habia 3.079 en ubicacion asignada y 0 enviados). Un borrador o uno
 * cancelado no se sube.
 */
export const ESTADOS_GOURMET_CARGABLE = [
  'UBICACION_ASIGNADA', 'ENVIADO_A_TRANSPORTE', 'EN_CARGUE', 'CARGUE_COMPLETO', 'CARGUE_COMPLETO_MANUAL', 'CON_NOVEDAD',
] as const
/** Los que al subirlos al camion pasan a «cargue completo (manual)». */
export const ESTADOS_GOURMET_POR_COMPLETAR = ['UBICACION_ASIGNADA', 'ENVIADO_A_TRANSPORTE'] as const
/** Muebles: inspeccionada (lista) o ya entregada a transporte por el patinador. */
export const ESTADOS_MUEBLES_CARGABLE = ['INSPECCIONADA', 'ENTREGADA_TRANSPORTE'] as const

export function gourmetCargable(estado: string): boolean {
  return (ESTADOS_GOURMET_CARGABLE as readonly string[]).includes(estado)
}
export function mueblesCargable(estado: string): boolean {
  return (ESTADOS_MUEBLES_CARGABLE as readonly string[]).includes(estado)
}

/**
 * Bultos de muebles: lo que sube al camion son cajas. Si el PLU viene en caja
 * master de varias unidades ("Und Emp" del maestro > 1, p.ej. 4 sillas por
 * caja), son las cajas master redondeadas hacia arriba: 8 sillas = 2 bultos.
 * Si no, cada unidad lleva sus partes: unidades x partes.
 */
export function bultosMuebles(
  lineas: ReadonlyArray<{ unidades: number; partes: number | null; unidadesPorCaja?: number | null }>,
): number {
  return lineas.reduce((s, l) => {
    const porCaja = l.unidadesPorCaja ?? 1
    return s + (porCaja > 1 ? Math.ceil(l.unidades / porCaja) : l.unidades * Math.max(1, l.partes ?? 1))
  }, 0)
}

export type OrigenCargue = 'GOURMET' | 'MUEBLES' | 'AMBOS' | 'MANUAL'

export function origenDe(gourmet: boolean, muebles: boolean): OrigenCargue {
  if (gourmet && muebles) return 'AMBOS'
  if (gourmet) return 'GOURMET'
  if (muebles) return 'MUEBLES'
  return 'MANUAL'
}

/**
 * Al finalizar una orden: los bultos contados, y si no cuadran con lo
 * declarado, la nota es obligatoria (queda como novedad).
 */
export function validarFinOrden(d: {
  declarados: number | null
  cargados: unknown
  nota?: string | null
}): string | null {
  const n = Number(d.cargados)
  if (!Number.isInteger(n) || n < 0) return 'Escribe cuantos bultos se cargaron'
  if (d.declarados != null && n !== d.declarados && limpio(d.nota).length < 5) {
    return `Se declararon ${d.declarados} bultos y se cargaron ${n}: escribe que paso (minimo 5 caracteres)`
  }
  return null
}

export function hayDiferencia(o: { bultosDeclarados: number | null; bultosCargados: number | null }): boolean {
  return o.bultosDeclarados != null && o.bultosCargados != null && o.bultosDeclarados !== o.bultosCargados
}

/** El camion se finaliza sin ordenes a medias y con al menos una cargada. */
export function validarCierreCamion(ordenes: ReadonlyArray<{ horaFin: Date | string | null }>): string | null {
  if (!ordenes.length) return 'Agrega al menos una orden antes de finalizar el camion'
  if (ordenes.some((o) => !o.horaFin)) return 'Hay una orden en cargue: finalizala antes de cerrar el camion'
  return null
}
