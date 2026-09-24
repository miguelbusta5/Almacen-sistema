// Indicadores por PROCESO (23-09): lo que el CEDI mueve por dia y por persona
// en movimientos, pendientes y resurtido, el tiempo en tareas generales y la
// recepcion de contenedores clasificada.
//
// Puro (sin Prisma). No tiene gemelo en src/lib: sus tests lo cargan con
// cargarNuxt (ver src/__tests__/apoyo/nuxt.ts).
//
// Reglas (CEDI, 23-09):
// - "Por dia" es por DIA TRABAJADO de esa persona en ese proceso (dias con al
//   menos un cierre), igual que la proyeccion diaria: un dia de descanso no es
//   un dia flojo.
// - La META de cada proceso sale sola de los datos: el dia tipico (mediana) de
//   las 4 semanas anteriores al periodo, sobre todos los (persona, dia)
//   trabajados. Nadie la edita. Semaforo: verde >= meta, amarillo >= 80 %.
// - Todo se compara con el periodo anterior del mismo largo.
// - Desde el 24-09 un registro CUENTA A TODOS los que lo tuvieron (el que lo
//   empezo, el que lo siguio y el que lo cerro suman uno cada uno, con sus
//   unidades, m3 y kg). Lo del EQUIPO cuenta cada registro una vez: la suma de
//   las personas puede ser mayor que el total del equipo.

// ── Cierres por PLU (movimientos, pendientes, resurtido) ───────────────────

export interface CierreProceso {
  /** Quien lo cerro. */
  usuarioId: string
  /** Todos los que lo tuvieron, sin repetir (incluye a quien lo cerro). Sin
   *  dato, solo quien lo cerro. A cada uno le cuenta completo. */
  participantes?: string[]
  /** Dia de turno al que pertenece (lo resuelve quien llama, con el cuadro). */
  dia: string
  plu: string
  descripcion?: string | null
  unidades: number
  /** Null si el PLU no esta medido en el maestro: no suma cero. */
  m3: number | null
  kg: number | null
}

export interface Cifras {
  /** PLU cerrados (uno por registro). */
  plus: number
  unidades: number
  m3: number
  kg: number
}

export interface PersonaProceso {
  usuarioId: string
  nombre: string
  dias: number
  total: Cifras
  /** Promedio por dia trabajado. */
  porDia: Cifras
  /** Frente a la meta del proceso (PLU por dia). Null sin meta. */
  semaforo: 'verde' | 'amarillo' | 'rojo' | null
}

export interface ResumenProceso {
  total: Cifras
  /** Dias con al menos un cierre de alguien. */
  dias: number
  /** Lo que cierra el equipo junto en un dia con actividad. */
  equipoDia: Cifras
  /** Lo que cierra UNA persona en un dia trabajado (promedio de persona-dia). */
  personaDia: Cifras
  sinMedida: number
  personas: PersonaProceso[]
  serie: Array<{ dia: string } & Cifras>
  topPlus: Array<{ plu: string; descripcion: string | null; veces: number; unidades: number }>
}

const r = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d
const cero = (): Cifras => ({ plus: 0, unidades: 0, m3: 0, kg: 0 })
function sumar(a: Cifras, c: { unidades: number; m3: number | null; kg: number | null }) {
  a.plus++
  a.unidades += c.unidades
  a.m3 += c.m3 ?? 0
  a.kg += c.kg ?? 0
}
const dividir = (a: Cifras, n: number): Cifras => (n > 0
  ? { plus: r(a.plus / n), unidades: r(a.unidades / n), m3: r(a.m3 / n, 2), kg: r(a.kg / n) }
  : cero())
const redondear = (a: Cifras): Cifras => ({ plus: a.plus, unidades: a.unidades, m3: r(a.m3, 3), kg: r(a.kg, 1) })

export function medianaProceso(v: readonly number[]): number | null {
  if (!v.length) return null
  const o = [...v].sort((a, b) => a - b)
  const m = Math.floor(o.length / 2)
  return o.length % 2 ? o[m]! : (o[m - 1]! + o[m]!) / 2
}

/** La meta: el dia tipico de una persona (mediana de PLU por persona-dia). */
/** A quienes les cuenta un registro: todos los que lo tuvieron (o quien lo cerro). */
export function acreditados(c: CierreProceso): string[] {
  return c.participantes?.length ? c.participantes : [c.usuarioId]
}

export function metaDeProceso(historico: readonly CierreProceso[]): { plus: number; unidades: number } | null {
  const pd = new Map<string, { plus: number; unidades: number }>()
  for (const c of historico) {
    for (const u of acreditados(c)) {
      const k = `${u}|${c.dia}`
      const x = pd.get(k) ?? { plus: 0, unidades: 0 }
      x.plus++
      x.unidades += c.unidades
      pd.set(k, x)
    }
  }
  const plus = medianaProceso([...pd.values()].map((x) => x.plus))
  const unidades = medianaProceso([...pd.values()].map((x) => x.unidades))
  return plus == null || unidades == null ? null : { plus: r(plus), unidades: r(unidades) }
}

export function semaforo(valor: number, meta: number | null | undefined): 'verde' | 'amarillo' | 'rojo' | null {
  if (!meta) return null
  if (valor >= meta) return 'verde'
  return valor >= meta * 0.8 ? 'amarillo' : 'rojo'
}

/**
 * `personas`: si viene, solo a ellas se les acredita y solo cuentan los
 * registros en que participo alguna (el filtro de turno o de persona).
 */
export function resumenProceso(
  cierres: readonly CierreProceso[],
  nombres: ReadonlyMap<string, string>,
  meta: { plus: number } | null = null,
  personas: ReadonlySet<string> | null = null,
): ResumenProceso {
  const total = cero()
  const porDia = new Map<string, Cifras>()
  const porPersona = new Map<string, { total: Cifras; dias: Set<string> }>()
  const personaDia = new Map<string, Cifras>()
  const plus = new Map<string, { descripcion: string | null; veces: number; unidades: number }>()
  let sinMedida = 0
  for (const c of cierres) {
    const quienes = acreditados(c).filter((u) => !personas || personas.has(u))
    if (!quienes.length) continue
    // El equipo: el registro una vez.
    sumar(total, c)
    if (c.m3 == null) sinMedida++
    const d = porDia.get(c.dia) ?? cero()
    sumar(d, c)
    porDia.set(c.dia, d)
    // Cada persona que lo tuvo: completo.
    for (const u of quienes) {
      const p = porPersona.get(u) ?? { total: cero(), dias: new Set<string>() }
      sumar(p.total, c)
      p.dias.add(c.dia)
      porPersona.set(u, p)
      const k = `${u}|${c.dia}`
      const pdx = personaDia.get(k) ?? cero()
      sumar(pdx, c)
      personaDia.set(k, pdx)
    }
    const x = plus.get(c.plu) ?? { descripcion: c.descripcion ?? null, veces: 0, unidades: 0 }
    x.veces++
    x.unidades += c.unidades
    x.descripcion ??= c.descripcion ?? null
    plus.set(c.plu, x)
  }
  const sumaPD = [...personaDia.values()].reduce((a, x) => ({
    plus: a.plus + x.plus, unidades: a.unidades + x.unidades, m3: a.m3 + x.m3, kg: a.kg + x.kg,
  }), cero())
  return {
    total: redondear(total),
    dias: porDia.size,
    equipoDia: dividir(total, porDia.size),
    personaDia: dividir(sumaPD, personaDia.size),
    sinMedida,
    personas: [...porPersona.entries()]
      .map(([usuarioId, p]) => {
        const pd = dividir(p.total, p.dias.size)
        return {
          usuarioId,
          nombre: nombres.get(usuarioId) ?? usuarioId,
          dias: p.dias.size,
          total: redondear(p.total),
          porDia: pd,
          semaforo: semaforo(pd.plus, meta?.plus),
        }
      })
      .sort((a, b) => b.porDia.plus - a.porDia.plus || a.nombre.localeCompare(b.nombre)),
    serie: [...porDia.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([dia, c]) => ({ dia, ...redondear(c) })),
    topPlus: [...plus.entries()]
      .map(([plu, x]) => ({ plu, ...x }))
      .sort((a, b) => b.veces - a.veces || b.unidades - a.unidades || a.plu.localeCompare(b.plu))
      .slice(0, 20),
  }
}

// ── Tareas generales ────────────────────────────────────────────────────────

export interface TramoGeneral {
  usuarioId: string
  dia: string
  descripcion: string
  segundos: number
}

export interface ResumenGenerales {
  segundos: number
  dias: number
  /** Segundos que el equipo pone en tareas generales en un dia con alguna. */
  equipoDiaSeg: number
  /** Segundos de una persona en un dia en que hizo alguna. */
  personaDiaSeg: number
  personas: Array<{ usuarioId: string; nombre: string; dias: number; segundos: number; porDiaSeg: number; tareas: number }>
  porDescripcion: Array<{ descripcion: string; veces: number; segundos: number; personas: number }>
  serie: Array<{ dia: string; segundos: number; personas: number }>
}

export function resumenGenerales(tramos: readonly TramoGeneral[], nombres: ReadonlyMap<string, string>): ResumenGenerales {
  let segundos = 0
  const porDia = new Map<string, { segundos: number; personas: Set<string> }>()
  const porPersona = new Map<string, { segundos: number; dias: Set<string>; tareas: number }>()
  const porDesc = new Map<string, { veces: number; segundos: number; personas: Set<string> }>()
  const pd = new Set<string>()
  for (const t of tramos) {
    segundos += t.segundos
    const d = porDia.get(t.dia) ?? { segundos: 0, personas: new Set<string>() }
    d.segundos += t.segundos
    d.personas.add(t.usuarioId)
    porDia.set(t.dia, d)
    const p = porPersona.get(t.usuarioId) ?? { segundos: 0, dias: new Set<string>(), tareas: 0 }
    p.segundos += t.segundos
    p.dias.add(t.dia)
    p.tareas++
    porPersona.set(t.usuarioId, p)
    pd.add(`${t.usuarioId}|${t.dia}`)
    const k = t.descripcion.trim().toUpperCase()
    const x = porDesc.get(k) ?? { veces: 0, segundos: 0, personas: new Set<string>() }
    x.veces++
    x.segundos += t.segundos
    x.personas.add(t.usuarioId)
    porDesc.set(k, x)
  }
  return {
    segundos,
    dias: porDia.size,
    equipoDiaSeg: porDia.size ? Math.round(segundos / porDia.size) : 0,
    personaDiaSeg: pd.size ? Math.round(segundos / pd.size) : 0,
    personas: [...porPersona.entries()]
      .map(([usuarioId, p]) => ({
        usuarioId, nombre: nombres.get(usuarioId) ?? usuarioId, dias: p.dias.size, segundos: p.segundos,
        porDiaSeg: Math.round(p.segundos / p.dias.size), tareas: p.tareas,
      }))
      .sort((a, b) => b.porDiaSeg - a.porDiaSeg || a.nombre.localeCompare(b.nombre)),
    porDescripcion: [...porDesc.entries()]
      .map(([descripcion, x]) => ({ descripcion, veces: x.veces, segundos: x.segundos, personas: x.personas.size }))
      .sort((a, b) => b.segundos - a.segundos)
      .slice(0, 20),
    serie: [...porDia.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dia, d]) => ({ dia, segundos: d.segundos, personas: d.personas.size })),
  }
}

// ── Recepcion de contenedores ───────────────────────────────────────────────

/** Rangos fijos (CEDI, 23-09): comparables mes a mes. */
export const RANGOS_RECEPCION = {
  unidades: [500, 2000, 5000],
  m3: [20, 40, 60],
  kg: [2000, 5000, 10000],
} as const

export function etiquetaRango(cortes: readonly number[], valor: number | null, unidad: string): string {
  if (valor == null) return 'Sin dato'
  const fmt = (n: number) => n.toLocaleString('es-CO')
  const i = cortes.findIndex((c) => valor < c)
  if (i === 0) return `Menos de ${fmt(cortes[0]!)} ${unidad}`
  if (i === -1) return `Más de ${fmt(cortes[cortes.length - 1]!)} ${unidad}`
  return `${fmt(cortes[i - 1]!)} – ${fmt(cortes[i]!)} ${unidad}`
}

export interface ContenedorProceso {
  proveedor: string
  tipoContenedor: string | null
  /** De la planilla (declarado al abrir). */
  unidades: number
  pesoKg: number
  /** Del montacarguista (mismo pedido, desde el 24-09). Null sin datos. */
  m3: number | null
  descargaMin: number
  /** Null si no hay PLU del montacarguista unidos. */
  almacenamientoMin: number | null
  trabajoMin: number | null
  cicloMin: number | null
  /** Descargadores + montacarguistas, sin repetir. */
  personas: number
}

export interface GrupoRecepcion {
  clave: string
  contenedores: number
  descargaMin: number
  /** Solo sobre los contenedores con almacenamiento medido. */
  almacenamientoMin: number | null
  trabajoMin: number | null
  cicloMin: number | null
  personas: number
  unidades: number
  kg: number
  m3: number | null
  conAlmacenamiento: number
}

function agrupar(items: readonly ContenedorProceso[], clave: (c: ContenedorProceso) => string, orden?: readonly string[]): GrupoRecepcion[] {
  const g = new Map<string, ContenedorProceso[]>()
  for (const c of items) {
    const k = clave(c)
    const l = g.get(k) ?? []
    l.push(c)
    g.set(k, l)
  }
  const prom = (v: number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null)
  return [...g.entries()]
    .map(([k, l]) => {
      const alm = l.filter((c) => c.almacenamientoMin != null)
      const m3 = l.filter((c) => c.m3 != null)
      return {
        clave: k,
        contenedores: l.length,
        descargaMin: r(prom(l.map((c) => c.descargaMin)) ?? 0),
        almacenamientoMin: alm.length ? r(prom(alm.map((c) => c.almacenamientoMin!))!) : null,
        trabajoMin: alm.length ? r(prom(alm.map((c) => c.trabajoMin!))!) : null,
        cicloMin: alm.filter((c) => c.cicloMin != null).length ? r(prom(alm.filter((c) => c.cicloMin != null).map((c) => c.cicloMin!))!) : null,
        personas: r(prom(l.map((c) => c.personas)) ?? 0),
        unidades: Math.round(prom(l.map((c) => c.unidades)) ?? 0),
        kg: Math.round(prom(l.map((c) => c.pesoKg)) ?? 0),
        m3: m3.length ? r(prom(m3.map((c) => c.m3!))!, 2) : null,
        conAlmacenamiento: alm.length,
      }
    })
    .sort((a, b) => (orden ? orden.indexOf(a.clave) - orden.indexOf(b.clave) : 0) || b.contenedores - a.contenedores)
}

export function resumenRecepcion(items: readonly ContenedorProceso[]) {
  // Orden de los rangos: de menor a mayor, y "Sin dato" al final.
  const ordenRango = (cortes: readonly number[], unidad: string) => [
    etiquetaRango(cortes, cortes[0]! - 1, unidad),
    ...cortes.map((c) => etiquetaRango(cortes, c, unidad)),
    'Sin dato',
  ]
  const tipoLabel: Record<string, string> = { PIES_40: '40 pies', PIES_20: '20 pies', CARGA_SUELTA: 'Carga suelta' }
  return {
    general: agrupar(items, () => 'Todos')[0] ?? null,
    porProveedor: agrupar(items, (c) => c.proveedor),
    porTipo: agrupar(items, (c) => tipoLabel[c.tipoContenedor ?? ''] ?? 'Sin tipo', ['40 pies', '20 pies', 'Carga suelta', 'Sin tipo']),
    porUnidades: agrupar(items, (c) => etiquetaRango(RANGOS_RECEPCION.unidades, c.unidades, 'und'), ordenRango(RANGOS_RECEPCION.unidades, 'und')),
    porVolumen: agrupar(items, (c) => etiquetaRango(RANGOS_RECEPCION.m3, c.m3, 'm³'), ordenRango(RANGOS_RECEPCION.m3, 'm³')),
    porPeso: agrupar(items, (c) => etiquetaRango(RANGOS_RECEPCION.kg, c.pesoKg, 'kg'), ordenRango(RANGOS_RECEPCION.kg, 'kg')),
  }
}
