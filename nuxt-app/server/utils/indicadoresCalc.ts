// Logica pura del tiempo laborado, para Nitro.
//
// Copia de src/lib/indicadores.ts (fuente de verdad): Nitro no puede importar
// de src/lib. Mantener en sync; hay tests que comparan los dos archivos.
//
// Cuenta el tiempo de RELOJ DE PARED en que la persona tuvo al menos un PLU en
// la mano, no la suma de sus relojes: tres tapetes a la vez durante 3 minutos
// son 3 minutos de trabajo, no 9.

export const TIPOS_TAREA = [
  "recepcion",
  "movimiento",
  "resurtido",
  "pendiente",
  "contenedor",
] as const
export type TipoTarea = (typeof TIPOS_TAREA)[number]

export const TIPO_TAREA_LABEL: Record<TipoTarea, string> = {
  recepcion: "Recepción",
  movimiento: "Movimientos",
  resurtido: "Resurtido",
  pendiente: "Pendientes",
  contenedor: "Recepción de contenedores",
}

export interface Intervalo {
  inicio: Date
  fin: Date
  tipo: TipoTarea
}

export interface Reparto {
  /** Segundos de reloj de pared con al menos un PLU en la mano. */
  total: number
  /**
   * Esos mismos segundos repartidos por tipo de tarea. Suman EXACTAMENTE
   * `total`: en un tramo con tareas de dos tipos a la vez, el tiempo se parte a
   * partes iguales entre ellos en vez de contarse entero en los dos.
   */
  porTipo: Record<TipoTarea, number>
}

function vacio(): Record<TipoTarea, number> {
  return { recepcion: 0, movimiento: 0, resurtido: 0, pendiente: 0, contenedor: 0 }
}

/**
 * Tiempo laborado de UNA persona a partir de todos sus intervalos.
 *
 * Barrido de línea: se ordenan todos los inicios y fines, y entre cada par de
 * instantes consecutivos se mira qué tareas estaban abiertas. Si había al menos
 * una, ese trozo cuenta UNA vez para la persona, y se reparte entre los tipos
 * que estaban activos.
 */
export function repartirTiempo(intervalos: readonly Intervalo[]): Reparto {
  const porTipo = vacio()
  const validos = intervalos.filter(
    (i) => i.fin.getTime() > i.inicio.getTime() && !Number.isNaN(i.inicio.getTime()),
  )
  if (validos.length === 0) return { total: 0, porTipo }

  // Cada intervalo aporta dos eventos: +1 al abrir y -1 al cerrar su tipo.
  const eventos: { t: number; tipo: TipoTarea; delta: 1 | -1 }[] = []
  for (const i of validos) {
    eventos.push({ t: i.inicio.getTime(), tipo: i.tipo, delta: 1 })
    eventos.push({ t: i.fin.getTime(), tipo: i.tipo, delta: -1 })
  }
  // Los cierres antes que las aperturas en el mismo instante: un tramo que acaba
  // justo cuando empieza otro no es un solape.
  eventos.sort((a, b) => a.t - b.t || a.delta - b.delta)

  const abiertos = vacio()
  let total = 0
  let previo = eventos[0].t

  for (const e of eventos) {
    const trozo = (e.t - previo) / 1000
    if (trozo > 0) {
      const activos = TIPOS_TAREA.filter((t) => abiertos[t] > 0)
      if (activos.length > 0) {
        total += trozo
        for (const t of activos) porTipo[t] += trozo / activos.length
      }
    }
    abiertos[e.tipo] += e.delta
    previo = e.t
  }

  return { total: Math.round(total), porTipo: redondearReparto(porTipo, Math.round(total)) }
}

/**
 * Redondea el reparto a segundos enteros sin que deje de sumar el total: el
 * sobrante del redondeo va al tipo con más tiempo, donde no se nota.
 */
function redondearReparto(
  porTipo: Record<TipoTarea, number>,
  total: number,
): Record<TipoTarea, number> {
  const r = vacio()
  let suma = 0
  for (const t of TIPOS_TAREA) {
    r[t] = Math.round(porTipo[t])
    suma += r[t]
  }
  const diferencia = total - suma
  if (diferencia !== 0) {
    const mayor = TIPOS_TAREA.reduce((a, b) => (porTipo[b] > porTipo[a] ? b : a))
    r[mayor] += diferencia
  }
  return r
}

// ── Días ─────────────────────────────────────────────────────────────
const MS_DIA = 24 * 60 * 60 * 1000
/** Colombia no tiene horario de verano: UTC-5 todo el año. */
const DESFASE_BOGOTA_MS = -5 * 60 * 60 * 1000

/** Fecha YYYY-MM-DD en hora de Bogotá. */
export function diaBogota(d: Date): string {
  return new Date(d.getTime() + DESFASE_BOGOTA_MS).toISOString().slice(0, 10)
}

/**
 * Parte un intervalo en los días de Bogotá que toca.
 *
 * Un tramo que cruza la medianoche cuenta una parte para cada día; sin esto la
 * evolución diaria le cargaría el turno de noche entero al día en que empezó.
 */
export function partirPorDia(i: Intervalo): { dia: string; intervalo: Intervalo }[] {
  const partes: { dia: string; intervalo: Intervalo }[] = []
  let desde = i.inicio.getTime()
  const hasta = i.fin.getTime()
  while (desde < hasta) {
    const local = desde + DESFASE_BOGOTA_MS
    const finDiaLocal = Math.floor(local / MS_DIA) * MS_DIA + MS_DIA
    const corte = Math.min(hasta, finDiaLocal - DESFASE_BOGOTA_MS)
    partes.push({
      dia: diaBogota(new Date(desde)),
      intervalo: { inicio: new Date(desde), fin: new Date(corte), tipo: i.tipo },
    })
    desde = corte
  }
  return partes
}

// ── Productividad ────────────────────────────────────────────────────
/**
 * Unidades por hora laborada. Es la cifra que separa a quien trabaja muchas
 * horas de quien rinde en ellas; se calcula sobre el tiempo REAL, así que ya no
 * castiga a quien lleva varios PLUs a la vez.
 */
export function unidadesPorHora(unidades: number, segundos: number): number | null {
  if (!Number.isFinite(unidades) || segundos <= 0) return null
  return Math.round((unidades / segundos) * 3600)
}

/** Promedio de una lista de segundos, o null si está vacía. */
export function promedio(valores: readonly number[]): number | null {
  if (valores.length === 0) return null
  return Math.round(valores.reduce((a, b) => a + b, 0) / valores.length)
}

// ── Agregado del periodo ─────────────────────────────────────────────
// Lo que devuelve la API. Vive aquí, puro, y no en el endpoint, para que la
// cuenta se pueda probar sin base de datos: el endpoint solo junta las filas.

export interface PersonaMedida {
  id: string
  nombre: string
  rol: string
}

/** Un tramo de reloj de UNA persona sobre un registro. */
export interface TiempoRegistrado {
  usuarioId: string
  inicio: Date
  fin: Date
  tipo: TipoTarea
  /**
   * El PLU o la tarea a la que pertenece el tramo. Los tramos de la misma
   * persona en el mismo registro forman UN reloj (un PLU con novedad tiene dos
   * tramos del mismo operario). null = no es trabajo por PLU (un contenedor)
   * y no entra en el promedio por PLU.
   */
  registro: string | null
}

/** Unidades ubicadas: de quien cerró el registro, el día que lo cerró. */
export interface UnidadesRegistradas {
  usuarioId: string
  cuando: Date
  unidades: number
}

export interface IndicadorPersona {
  id: string
  nombre: string
  rol: string
  /** Tiempo real laborado (reloj de pared). */
  segundos: number
  /** Lo que daba sumar los relojes: para ver cuánto se inflaba. */
  sumaRelojes: number
  porTipo: Record<TipoTarea, number>
  unidades: number
  plus: number
  unidadesPorHora: number | null
  promedioPorPlu: number | null
}

export interface IndicadoresPeriodo {
  resumen: {
    segundos: number
    sumaRelojes: number
    unidades: number
    /**
     * PLUs por persona, sumados: un PLU que pasó del montacarguista al
     * ayudante cuenta para los dos. Sirve para pesar el promedio por PLU.
     */
    plus: number
    /** PLUs distintos: ese mismo PLU cuenta una vez. */
    registros: number
    unidadesPorHora: number | null
    personas: number
  }
  personas: IndicadorPersona[]
  porDia: { dia: string; segundos: number; unidades: number }[]
  porTipo: Record<TipoTarea, number>
}

const RE_DIA = /^\d{4}-\d{2}-\d{2}$/

/** Inicio y fin (inclusive) de un rango de días de Bogotá. */
export function limitesRango(desde: string, hasta: string): { inicio: Date; fin: Date } {
  if (!RE_DIA.test(desde) || !RE_DIA.test(hasta)) throw new Error("Rango de fechas inválido")
  return {
    inicio: new Date(`${desde}T00:00:00-05:00`),
    fin: new Date(`${hasta}T23:59:59.999-05:00`),
  }
}

/** Todos los días del rango, también los que no tuvieron trabajo. */
export function diasDelRango(desde: string, hasta: string): string[] {
  const dias: string[] = []
  // Mediodía: lejos de la medianoche, así sumar 24 h nunca se salta un día.
  for (let t = new Date(`${desde}T12:00:00-05:00`).getTime(); diaBogota(new Date(t)) <= hasta; t += MS_DIA) {
    dias.push(diaBogota(new Date(t)))
  }
  return dias
}

function duracion(i: { inicio: Date; fin: Date }): number {
  return (i.fin.getTime() - i.inicio.getTime()) / 1000
}

/**
 * Indicadores de un periodo a partir de las tomas de tiempo de todos los módulos.
 *
 * - El tiempo de cada persona es reloj de pared (repartirTiempo), recortado al
 *   rango: lo que cae fuera no es de este periodo.
 * - Cada PLU conserva su propio reloj para el promedio por PLU.
 * - La productividad (und/hora) se mide solo sobre el trabajo por PLU: un
 *   contenedor no es un PLU, y sus miles de unidades la desvirtuarían.
 */
export function agregarIndicadores(entrada: {
  personas: readonly PersonaMedida[]
  tiempos: readonly TiempoRegistrado[]
  unidades: readonly UnidadesRegistradas[]
  desde: string
  hasta: string
}): IndicadoresPeriodo {
  const { inicio: ini, fin } = limitesRango(entrada.desde, entrada.hasta)
  const medidas = new Map(entrada.personas.map((p) => [p.id, p]))

  interface Acc {
    intervalos: Intervalo[]
    sumaRelojes: number
    relojes: Map<string, number>
    unidades: number
  }
  const acc = new Map<string, Acc>()
  const registros = new Set<string>()
  const de = (id: string): Acc => {
    let a = acc.get(id)
    if (!a) {
      a = { intervalos: [], sumaRelojes: 0, relojes: new Map(), unidades: 0 }
      acc.set(id, a)
    }
    return a
  }

  for (const t of entrada.tiempos) {
    if (!medidas.has(t.usuarioId)) continue
    const a = Math.max(t.inicio.getTime(), ini.getTime())
    const b = Math.min(t.fin.getTime(), fin.getTime())
    if (b <= a) continue
    const recortado: Intervalo = { inicio: new Date(a), fin: new Date(b), tipo: t.tipo }
    const p = de(t.usuarioId)
    p.intervalos.push(recortado)
    p.sumaRelojes += duracion(recortado)
    if (t.registro !== null) {
      p.relojes.set(t.registro, (p.relojes.get(t.registro) ?? 0) + duracion(recortado))
      registros.add(t.registro)
    }
  }

  const unidadesPorDia = new Map<string, number>()
  for (const u of entrada.unidades) {
    if (!medidas.has(u.usuarioId)) continue
    const t = u.cuando.getTime()
    if (t < ini.getTime() || t > fin.getTime()) continue
    de(u.usuarioId).unidades += u.unidades
    const dia = diaBogota(u.cuando)
    unidadesPorDia.set(dia, (unidadesPorDia.get(dia) ?? 0) + u.unidades)
  }

  const porTipo = vacio()
  const segundosPorDia = new Map<string, number>()

  const personas: IndicadorPersona[] = []
  for (const [id, a] of acc) {
    const persona = medidas.get(id)!
    const reparto = repartirTiempo(a.intervalos)
    for (const t of TIPOS_TAREA) porTipo[t] += reparto.porTipo[t]

    // Cada persona se calcula día a día: un tramo que cruza la medianoche no se
    // cuenta entero en el día en que empezó.
    const porDia = new Map<string, Intervalo[]>()
    for (const it of a.intervalos) {
      for (const parte of partirPorDia(it)) {
        const lista = porDia.get(parte.dia) ?? []
        lista.push(parte.intervalo)
        porDia.set(parte.dia, lista)
      }
    }
    for (const [dia, ints] of porDia) {
      segundosPorDia.set(dia, (segundosPorDia.get(dia) ?? 0) + repartirTiempo(ints).total)
    }

    if (reparto.total === 0 && a.unidades === 0) continue
    const relojes = [...a.relojes.values()]
    personas.push({
      id,
      nombre: persona.nombre,
      rol: persona.rol,
      segundos: reparto.total,
      sumaRelojes: Math.round(a.sumaRelojes),
      porTipo: reparto.porTipo,
      unidades: a.unidades,
      plus: relojes.length,
      unidadesPorHora: unidadesPorHora(a.unidades, reparto.total - reparto.porTipo.contenedor),
      promedioPorPlu: promedio(relojes),
    })
  }
  personas.sort((x, y) => y.segundos - x.segundos || x.nombre.localeCompare(y.nombre))

  const sumar = (f: (p: IndicadorPersona) => number) => personas.reduce((s, p) => s + f(p), 0)
  const unidadesTotal = sumar((p) => p.unidades)

  return {
    resumen: {
      segundos: sumar((p) => p.segundos),
      sumaRelojes: sumar((p) => p.sumaRelojes),
      unidades: unidadesTotal,
      plus: sumar((p) => p.plus),
      registros: registros.size,
      unidadesPorHora: unidadesPorHora(unidadesTotal, sumar((p) => p.segundos - p.porTipo.contenedor)),
      personas: personas.length,
    },
    personas,
    porDia: diasDelRango(entrada.desde, entrada.hasta).map((dia) => ({
      dia,
      segundos: segundosPorDia.get(dia) ?? 0,
      unidades: unidadesPorDia.get(dia) ?? 0,
    })),
    porTipo,
  }
}
