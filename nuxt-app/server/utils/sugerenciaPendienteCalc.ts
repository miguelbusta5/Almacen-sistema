// Copia para Nitro de src/lib/sugerenciaPendiente.ts (fuente de verdad y tests).
// Nitro no puede importar de src/lib: mantener identica; un test compara ambas.

/** Horas que un teorico sirve para sugerir alturas a los pendientes. */
export const HORAS_VIGENCIA_TEORICO = 12

export interface FilaTeorico {
  plu: string
  ubicacion: string
  disponible: number
  concepto: 'RETIRO' | 'ALMACENAMIENTO'
}

export interface AlturaSugerida {
  ubicacion: string
  /** Cajas master a bajar. Null si el maestro no tiene unidad de empaque. */
  cajas: number | null
  unidades: number
}

export interface SugerenciaPendiente {
  teoricoId: string | null
  teoricoCreadoAt: string | null
  calculadoAt: string
  picking: string | null
  /** De donde salio el picking: la capacidad registrada o el RETIRO del teorico. */
  pickingOrigen: 'CAPACIDAD' | 'TEORICO' | null
  unidadesPorCaja: number | null
  /** Lo que se le pide bajar y ubicar (con cajas completas, puede superar lo pedido). */
  unidadesSugeridas: number
  alturas: AlturaSugerida[]
  /** Unidades que no alcanzo a cubrir la reserva. */
  faltante: number
  avisos: string[]
}

/** Ubicaciones comparables: mayusculas, sin tildes ni espacios. */
export function claveUbicacion(v: unknown): string {
  return String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, '')
}

/** El teorico sirve si se cargo dentro de las ultimas HORAS_VIGENCIA_TEORICO. */
export function teoricoVigente(creadoAt: Date, ahora: Date): boolean {
  const edad = ahora.getTime() - creadoAt.getTime()
  return edad >= 0 && edad <= HORAS_VIGENCIA_TEORICO * 3600 * 1000
}

/**
 * Elige de que altura(s) sacar un pendiente.
 *
 * - Se trabaja en cajas completas: 5 unidades con caja de 6 son 1 caja (6 und),
 *   y eso es lo que se baja y se ubica. Sin unidad de empaque, en unidades.
 * - A cada altura se le descuenta lo ya comprometido (pendientes abiertos con
 *   sugerencia y tareas de resurtido abiertas), para no mandar a dos personas
 *   por la misma mercancia.
 * - Se elige la altura con MENOS existencia que cubra lo pedido; si ninguna
 *   alcanza sola, se combinan de menor a mayor y se reporta el faltante.
 */
export function sugerirAlturas(entrada: {
  unidadesSolicitadas: number
  unidadesPorCaja: number | null
  /** Filas del teorico de ESTE PLU. */
  filas: readonly FilaTeorico[]
  /** Unidades ya comprometidas por ubicacion (clave = claveUbicacion). */
  comprometido: ReadonlyMap<string, number>
}): { alturas: AlturaSugerida[]; unidadesSugeridas: number; faltante: number } {
  const upc = entrada.unidadesPorCaja && Number.isSafeInteger(entrada.unidadesPorCaja) && entrada.unidadesPorCaja > 0
    ? entrada.unidadesPorCaja
    : null
  const pedido = Math.max(0, Math.floor(entrada.unidadesSolicitadas))
  const cajasPedidas = upc ? Math.ceil(pedido / upc) : 0
  const unidadesSugeridas = upc ? cajasPedidas * upc : pedido
  if (unidadesSugeridas === 0) return { alturas: [], unidadesSugeridas: 0, faltante: 0 }

  // Existencia efectiva por altura (sumando filas repetidas de la misma ubicacion).
  const porUbicacion = new Map<string, { ubicacion: string; disponible: number }>()
  for (const f of entrada.filas) {
    if (f.concepto !== 'ALMACENAMIENTO') continue
    const clave = claveUbicacion(f.ubicacion)
    const previa = porUbicacion.get(clave)
    if (previa) previa.disponible += f.disponible
    else porUbicacion.set(clave, { ubicacion: f.ubicacion, disponible: f.disponible })
  }
  const alturas = [...porUbicacion.entries()]
    .map(([clave, a]) => {
      const efectivo = Math.max(0, a.disponible - (entrada.comprometido.get(clave) ?? 0))
      return { ubicacion: a.ubicacion, efectivo, capacidad: upc ? Math.floor(efectivo / upc) : Math.floor(efectivo) }
    })
    .filter((a) => a.capacidad > 0)
    .sort((a, z) => a.efectivo - z.efectivo || a.ubicacion.localeCompare(z.ubicacion))

  const necesario = upc ? cajasPedidas : pedido
  const sola = alturas.find((a) => a.capacidad >= necesario)
  const elegidas: AlturaSugerida[] = []
  let faltan = necesario
  for (const a of sola ? [sola] : alturas) {
    const toma = Math.min(faltan, a.capacidad)
    if (toma > 0) {
      elegidas.push({ ubicacion: a.ubicacion, cajas: upc ? toma : null, unidades: upc ? toma * upc : toma })
      faltan -= toma
    }
    if (faltan === 0) break
  }
  return { alturas: elegidas, unidadesSugeridas, faltante: upc ? faltan * upc : faltan }
}

/**
 * ¿El operario uso lo sugerido? Compara la ubicacion inicial con las alturas y
 * la final con el picking. Null donde no hay nada que comparar.
 */
export function desvioSugerencia(
  sugerencia: Pick<SugerenciaPendiente, 'alturas' | 'picking'> | null,
  ubicacionInicial: string | null,
  ubicacionFinal: string | null,
): { altura: boolean | null; picking: boolean | null } {
  if (!sugerencia) return { altura: null, picking: null }
  const altura = sugerencia.alturas.length && ubicacionInicial
    ? !sugerencia.alturas.some((a) => claveUbicacion(a.ubicacion) === claveUbicacion(ubicacionInicial))
    : null
  const picking = sugerencia.picking && ubicacionFinal
    ? claveUbicacion(sugerencia.picking) !== claveUbicacion(ubicacionFinal)
    : null
  return { altura, picking }
}
