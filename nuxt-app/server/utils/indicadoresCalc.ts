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
  let previo = eventos[0]!.t

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

/**
 * El turno de una persona un día concreto: contra esto se mide la efectividad.
 *
 * Sale del cuadro de turnos (src/lib/turnos.ts). Sin cuadro no hay ventana, y
 * entonces solo se puede decir cuánto trabajó, no qué parte de su jornada fue.
 */
export interface VentanaTurno {
  usuarioId: string
  /** Día de Bogotá al que pertenece el turno (el que empieza). */
  dia: string
  inicio: Date
  fin: Date
}

/** Intervalos ordenados y unidos: los ratos en que hubo trabajo, sin repetir. */
function bloquesDeTrabajo(intervalos: readonly { inicio: Date; fin: Date }[]): { a: number; b: number }[] {
  const lista = intervalos
    .filter((i) => i.fin.getTime() > i.inicio.getTime())
    .map((i) => ({ a: i.inicio.getTime(), b: i.fin.getTime() }))
    .sort((x, y) => x.a - y.a)
  const bloques: { a: number; b: number }[] = []
  for (const it of lista) {
    const ultimo = bloques[bloques.length - 1]
    if (ultimo && it.a <= ultimo.b) ultimo.b = Math.max(ultimo.b, it.b)
    else bloques.push({ ...it })
  }
  return bloques
}

/** Segundos de trabajo que caen DENTRO del turno. */
export function segundosEnVentanas(
  intervalos: readonly { inicio: Date; fin: Date }[],
  ventanas: readonly { inicio: Date; fin: Date }[],
): number {
  const bloques = bloquesDeTrabajo(intervalos)
  let total = 0
  for (const v of ventanas) {
    for (const b of bloques) {
      const a = Math.max(b.a, v.inicio.getTime())
      const z = Math.min(b.b, v.fin.getTime())
      if (z > a) total += (z - a) / 1000
    }
  }
  return Math.round(total)
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
  /** Lo que dice el cuadro de turnos que debía trabajar en el periodo. */
  jornadaSegundos: number
  /** De su tiempo real, lo que cayó dentro del turno. */
  segundosEnTurno: number
  /** Porcentaje de la jornada con trabajo registrado. Null sin turno cargado. */
  efectividad: number | null
  /** Su evolución: un punto por día del periodo, también los que no trabajó. */
  porDia: { dia: string; segundos: number; unidades: number }[]
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
    jornadaSegundos: number
    segundosEnTurno: number
    efectividad: number | null
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
  /** Turnos del periodo, si hay cuadro cargado. */
  ventanas?: readonly VentanaTurno[]
  desde: string
  hasta: string
}): IndicadoresPeriodo {
  const { inicio: ini, fin } = limitesRango(entrada.desde, entrada.hasta)
  const medidas = new Map(entrada.personas.map((p) => [p.id, p]))

  // La jornada se recorta al periodo: un turno de noche que empieza el último
  // día no cuenta entero si el rango termina a medianoche.
  const ventanasPorPersona = new Map<string, { inicio: Date; fin: Date }[]>()
  for (const v of entrada.ventanas ?? []) {
    if (!medidas.has(v.usuarioId)) continue
    const a = Math.max(v.inicio.getTime(), ini.getTime())
    const b = Math.min(v.fin.getTime(), fin.getTime())
    if (b <= a) continue
    const lista = ventanasPorPersona.get(v.usuarioId) ?? []
    lista.push({ inicio: new Date(a), fin: new Date(b) })
    ventanasPorPersona.set(v.usuarioId, lista)
  }

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
  const unidadesPersonaDia = new Map<string, Map<string, number>>()
  for (const u of entrada.unidades) {
    if (!medidas.has(u.usuarioId)) continue
    const t = u.cuando.getTime()
    if (t < ini.getTime() || t > fin.getTime()) continue
    de(u.usuarioId).unidades += u.unidades
    const dia = diaBogota(u.cuando)
    unidadesPorDia.set(dia, (unidadesPorDia.get(dia) ?? 0) + u.unidades)
    const suyas = unidadesPersonaDia.get(u.usuarioId) ?? new Map<string, number>()
    suyas.set(dia, (suyas.get(dia) ?? 0) + u.unidades)
    unidadesPersonaDia.set(u.usuarioId, suyas)
  }

  const dias = diasDelRango(entrada.desde, entrada.hasta)

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
    const suyosPorDia = new Map<string, number>()
    for (const [dia, ints] of porDia) {
      const seg = repartirTiempo(ints).total
      suyosPorDia.set(dia, seg)
      segundosPorDia.set(dia, (segundosPorDia.get(dia) ?? 0) + seg)
    }

    if (reparto.total === 0 && a.unidades === 0) continue
    const relojes = [...a.relojes.values()]
    const ventanas = ventanasPorPersona.get(id) ?? []
    const jornadaSegundos = Math.round(
      ventanas.reduce((s, v) => s + (v.fin.getTime() - v.inicio.getTime()) / 1000, 0),
    )
    const segundosEnTurno = ventanas.length > 0 ? segundosEnVentanas(a.intervalos, ventanas) : 0
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
      jornadaSegundos,
      segundosEnTurno,
      efectividad: jornadaSegundos > 0 ? Math.round((segundosEnTurno / jornadaSegundos) * 100) : null,
      // La evolución es de cada persona: la del equipo sumaba horas de gente
      // distinta y daba más que cualquier turno.
      porDia: dias.map((dia) => ({
        dia,
        segundos: suyosPorDia.get(dia) ?? 0,
        unidades: unidadesPersonaDia.get(id)?.get(dia) ?? 0,
      })),
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
      jornadaSegundos: sumar((p) => p.jornadaSegundos),
      segundosEnTurno: sumar((p) => p.segundosEnTurno),
      // Una razón, no una suma de horas: cuánto del turno del equipo fue trabajo.
      efectividad: sumar((p) => p.jornadaSegundos) > 0
        ? Math.round((sumar((p) => p.segundosEnTurno) / sumar((p) => p.jornadaSegundos)) * 100)
        : null,
    },
    personas,
    porDia: dias.map((dia) => ({
      dia,
      segundos: segundosPorDia.get(dia) ?? 0,
      unidades: unidadesPorDia.get(dia) ?? 0,
    })),
    porTipo,
  }
}

// ── Tiempos muertos ──────────────────────────────────────────────────
// Un tiempo muerto es un rato sin NINGÚN PLU en la mano entre el primero y el
// último del día de una persona. No se guarda: sale de los mismos tramos que el
// tiempo laborado. Lo que se guarda es la justificación que le da un supervisor,
// con el rato de reloj que cubre.
//
// Lo de antes del primer PLU y después del último no se cuenta todavía: sin el
// horario del turno no se sabe si la persona ya había entrado o ya se había ido.

/** Menos que esto es ir por el siguiente PLU, no un tiempo muerto. */
export const MIN_TIEMPO_MUERTO_SEG = 10 * 60

/**
 * Un hueco de esto o más es un cambio de turno, no un tiempo muerto.
 *
 * No se puede cortar por día de calendario: hay turnos de noche (de 22:00 a
 * 05:00) y cortando a medianoche el rato entre un turno y el siguiente —de las
 * 05:00 a las 22:00— salía como 17 horas de tiempo muerto. Mientras no estén
 * cargados los horarios de los turnos, un hueco así de largo es la persona que
 * se fue a su casa.
 */
export const MAX_HUECO_EN_TURNO_SEG = 4 * 60 * 60

/** Un resto sin cubrir menor que esto es ruido de reloj, no algo que revisar. */
const TOLERANCIA_PENDIENTE_SEG = 60

export const MOTIVOS_TIEMPO_MUERTO = [
  "ALMUERZO",
  "PAUSA",
  "ESPERA_MERCANCIA",
  "EQUIPO",
  "NOVEDAD",
  "REUNION",
  "ORDEN_ASEO",
  "APOYO_OTRA_AREA",
  "TAREA_SIN_REGISTRO",
  "PERMISO",
  "OTRO",
  "SIN_JUSTIFICACION",
] as const
export type MotivoTiempoMuerto = (typeof MOTIVOS_TIEMPO_MUERTO)[number]

export const MOTIVO_TIEMPO_MUERTO_LABEL: Record<MotivoTiempoMuerto, string> = {
  ALMUERZO: "Almuerzo",
  PAUSA: "Pausa activa o descanso",
  ESPERA_MERCANCIA: "Esperando mercancía o contenedor",
  EQUIPO: "Montacargas o equipo no disponible",
  NOVEDAD: "Verificando una novedad",
  REUNION: "Reunión o capacitación",
  ORDEN_ASEO: "Orden y aseo",
  APOYO_OTRA_AREA: "Apoyo a otra área",
  TAREA_SIN_REGISTRO: "Tarea sin toma de tiempo",
  PERMISO: "Permiso o ausencia",
  OTRO: "Otro",
  // También es una respuesta: el supervisor lo revisó y fue tiempo perdido.
  SIN_JUSTIFICACION: "Sin justificación",
}

export function esMotivoTiempoMuerto(v: unknown): v is MotivoTiempoMuerto {
  return typeof v === "string" && (MOTIVOS_TIEMPO_MUERTO as readonly string[]).includes(v)
}

export const MAX_TRAMOS_POR_JUSTIFICACION = 200
const MAX_OBSERVACION = 500

/**
 * Valida una justificación (uno o varios tiempos muertos con el mismo motivo).
 * Devuelve el mensaje de error o null.
 */
export function validarJustificacion(entrada: {
  motivo: unknown
  observacion?: unknown
  tramos: unknown
  ahora?: Date
}): string | null {
  if (!esMotivoTiempoMuerto(entrada.motivo)) return "Elige un motivo de la lista"
  const obs = entrada.observacion
  if (obs != null && typeof obs !== "string") return "La observación no es válida"
  const texto = typeof obs === "string" ? obs.trim() : ""
  if (texto.length > MAX_OBSERVACION) return `La observación admite hasta ${MAX_OBSERVACION} caracteres`
  // "Otro" sin explicar no justifica nada.
  if (entrada.motivo === "OTRO" && texto.length < 3) return "Con el motivo Otro, escribe qué pasó"

  const tramos = entrada.tramos
  if (!Array.isArray(tramos) || tramos.length === 0) return "No hay tiempos muertos que justificar"
  if (tramos.length > MAX_TRAMOS_POR_JUSTIFICACION) {
    return `Como máximo ${MAX_TRAMOS_POR_JUSTIFICACION} tiempos muertos a la vez`
  }
  const limite = (entrada.ahora ?? new Date()).getTime() + 60_000
  for (const t of tramos) {
    const r = t as { usuarioId?: unknown; inicio?: unknown; fin?: unknown }
    if (typeof r?.usuarioId !== "string" || !r.usuarioId) return "Falta la persona de un tiempo muerto"
    const ini = new Date(String(r.inicio))
    const fin = new Date(String(r.fin))
    if (Number.isNaN(ini.getTime()) || Number.isNaN(fin.getTime())) return "Hay un tiempo muerto con horas inválidas"
    if (fin.getTime() <= ini.getTime()) return "Hay un tiempo muerto que termina antes de empezar"
    if (fin.getTime() - ini.getTime() > MS_DIA) return "Un tiempo muerto no puede pasar de un día"
    if (fin.getTime() > limite) return "No se puede justificar un tiempo que todavía no ha pasado"
  }
  return null
}

/** Final del día de Bogotá en que cae `d` (el último milisegundo). */
export function finDelDiaBogota(d: Date): Date {
  const local = d.getTime() + DESFASE_BOGOTA_MS
  return new Date(Math.floor(local / MS_DIA) * MS_DIA + MS_DIA - DESFASE_BOGOTA_MS - 1)
}

export interface Hueco {
  dia: string
  inicio: Date
  fin: Date
}

/**
 * Los ratos sin nada en la mano de UNA persona.
 *
 * Primero se juntan los intervalos que se pisan o se tocan en bloques de
 * trabajo; los huecos son lo que queda entre un bloque y el siguiente. Se mira
 * la línea de tiempo entera, sin cortar a medianoche (turnos de noche), y un
 * hueco de MAX_HUECO_EN_TURNO_SEG o más se toma como cambio de turno. El hueco
 * se apunta al día en que empezó.
 */
export function detectarTiemposMuertos(
  intervalos: readonly Intervalo[],
  minimoSeg: number = MIN_TIEMPO_MUERTO_SEG,
  maximoSeg: number = MAX_HUECO_EN_TURNO_SEG,
): Hueco[] {
  const lista = bloquesDeTrabajo(intervalos)
  if (lista.length === 0) return []

  const huecos: Hueco[] = []
  let finBloque = lista[0]!.b
  for (const it of lista.slice(1)) {
    if (it.a > finBloque) {
      const seg = (it.a - finBloque) / 1000
      if (seg >= minimoSeg && seg < maximoSeg) {
        const inicio = new Date(finBloque)
        huecos.push({ dia: diaBogota(inicio), inicio, fin: new Date(it.a) })
      }
      finBloque = it.b
    } else if (it.b > finBloque) {
      finBloque = it.b
    }
  }
  return huecos
}

/**
 * Los ratos parados DENTRO del turno, cuando hay cuadro cargado.
 *
 * Aquí sí cuenta lo de antes del primer PLU y lo de después del último: con el
 * turno delante se sabe que la persona ya había entrado o todavía no se había
 * ido. Así el tiempo muerto y el trabajado suman exactamente la jornada.
 */
export function huecosEnVentana(
  intervalos: readonly Intervalo[],
  ventana: { dia: string; inicio: Date; fin: Date },
  minimoSeg: number = MIN_TIEMPO_MUERTO_SEG,
): Hueco[] {
  const a = ventana.inicio.getTime()
  const b = ventana.fin.getTime()
  const bloques = bloquesDeTrabajo(intervalos)
    .map((x) => ({ a: Math.max(x.a, a), b: Math.min(x.b, b) }))
    .filter((x) => x.b > x.a)

  const huecos: Hueco[] = []
  const apuntar = (desde: number, hasta: number) => {
    if ((hasta - desde) / 1000 >= minimoSeg) {
      huecos.push({ dia: ventana.dia, inicio: new Date(desde), fin: new Date(hasta) })
    }
  }
  let cursor = a
  for (const bloque of bloques) {
    apuntar(cursor, bloque.a)
    cursor = Math.max(cursor, bloque.b)
  }
  apuntar(cursor, b)
  return huecos
}

export interface JustificacionTiempoMuerto {
  id: string
  usuarioId: string
  inicio: Date
  fin: Date
  motivo: MotivoTiempoMuerto
  observacion: string | null
  justificadoPor: string
  justificadoAt: Date
}

export type EstadoTiempoMuerto = "pendiente" | "justificado" | "sin_justificacion"

export interface TiempoMuertoDetalle {
  usuarioId: string
  nombre: string
  rol: string
  dia: string
  inicio: Date
  fin: Date
  segundos: number
  estado: EstadoTiempoMuerto
  /** Lo que todavía nadie ha explicado. */
  segundosPendientes: number
  /** La justificación que cubre la mayor parte del rato, si hay alguna. */
  justificacion: {
    id: string
    motivo: MotivoTiempoMuerto
    observacion: string | null
    justificadoPor: string
    justificadoAt: Date
  } | null
}

export interface TiempoMuertoPersona {
  id: string
  nombre: string
  rol: string
  segundos: number
  justificados: number
  sinJustificacion: number
  pendientes: number
  cantidad: number
}

export interface TiemposMuertosPeriodo {
  minimoSegundos: number
  /** Desde aquí, un hueco es cambio de turno y no tiempo muerto. */
  maximoSegundos: number
  /** Hay cuadro de turnos: los huecos van acotados a la jornada. */
  conTurnos: boolean
  resumen: {
    segundos: number
    justificados: number
    sinJustificacion: number
    pendientes: number
    cantidad: number
    cantidadPendientes: number
  }
  personas: TiempoMuertoPersona[]
  /** Tiempo revisado por motivo (incluye "Sin justificación"), de más a menos. */
  porMotivo: { motivo: MotivoTiempoMuerto; segundos: number }[]
  /** Cada tiempo muerto, el más reciente primero. */
  tramos: TiempoMuertoDetalle[]
}

/**
 * Reparte un hueco entre las justificaciones que lo tocan. Si dos se pisan,
 * manda la más reciente: justificar otra vez un rato es corregir la anterior.
 */
function cubrirHueco(
  hueco: Hueco,
  justificaciones: readonly JustificacionTiempoMuerto[],
): { porJustificacion: Map<string, number>; cubierto: number } {
  const a = hueco.inicio.getTime()
  const b = hueco.fin.getTime()
  const tocan = justificaciones.filter((j) => j.inicio.getTime() < b && j.fin.getTime() > a)
  const porJustificacion = new Map<string, number>()
  if (tocan.length === 0) return { porJustificacion, cubierto: 0 }

  const cortes = new Set<number>([a, b])
  for (const j of tocan) {
    cortes.add(Math.max(a, j.inicio.getTime()))
    cortes.add(Math.min(b, j.fin.getTime()))
  }
  const puntos = [...cortes].sort((x, y) => x - y)
  const recientes = [...tocan].sort((x, y) => y.justificadoAt.getTime() - x.justificadoAt.getTime())
  let cubierto = 0
  for (let k = 0; k < puntos.length - 1; k++) {
    const desde = puntos[k]!
    const hasta = puntos[k + 1]!
    const j = recientes.find((x) => x.inicio.getTime() <= desde && x.fin.getTime() >= hasta)
    if (!j) continue
    const seg = (hasta - desde) / 1000
    porJustificacion.set(j.id, (porJustificacion.get(j.id) ?? 0) + seg)
    cubierto += seg
  }
  return { porJustificacion, cubierto }
}

/**
 * Tiempos muertos de un periodo, con lo que ya justificaron los supervisores.
 *
 * `tiempos` debe traer también lo que sigue en curso (con el fin puesto en
 * "ahora"): una persona con un PLU abierto está trabajando, no parada.
 */
export function agregarTiemposMuertos(entrada: {
  personas: readonly PersonaMedida[]
  tiempos: readonly TiempoRegistrado[]
  justificaciones: readonly JustificacionTiempoMuerto[]
  /** Turnos del periodo, si hay cuadro cargado. */
  ventanas?: readonly VentanaTurno[]
  desde: string
  hasta: string
  minimoSeg?: number
}): TiemposMuertosPeriodo {
  const minimo = entrada.minimoSeg ?? MIN_TIEMPO_MUERTO_SEG
  const maximo = MAX_HUECO_EN_TURNO_SEG
  const { inicio: ini, fin } = limitesRango(entrada.desde, entrada.hasta)
  const medidas = new Map(entrada.personas.map((p) => [p.id, p]))

  const intervalos = new Map<string, Intervalo[]>()
  for (const t of entrada.tiempos) {
    if (!medidas.has(t.usuarioId)) continue
    const a = Math.max(t.inicio.getTime(), ini.getTime())
    const b = Math.min(t.fin.getTime(), fin.getTime())
    if (b <= a) continue
    const lista = intervalos.get(t.usuarioId) ?? []
    lista.push({ inicio: new Date(a), fin: new Date(b), tipo: t.tipo })
    intervalos.set(t.usuarioId, lista)
  }
  const ventanasPorPersona = new Map<string, VentanaTurno[]>()
  for (const v of entrada.ventanas ?? []) {
    if (!medidas.has(v.usuarioId)) continue
    const a = Math.max(v.inicio.getTime(), ini.getTime())
    const b = Math.min(v.fin.getTime(), fin.getTime())
    if (b <= a) continue
    const lista = ventanasPorPersona.get(v.usuarioId) ?? []
    lista.push({ ...v, inicio: new Date(a), fin: new Date(b) })
    ventanasPorPersona.set(v.usuarioId, lista)
  }

  const justPorPersona = new Map<string, JustificacionTiempoMuerto[]>()
  for (const j of entrada.justificaciones) {
    const lista = justPorPersona.get(j.usuarioId) ?? []
    lista.push(j)
    justPorPersona.set(j.usuarioId, lista)
  }

  const tramos: TiempoMuertoDetalle[] = []
  const personas: TiempoMuertoPersona[] = []
  const porMotivo = new Map<MotivoTiempoMuerto, number>()

  for (const [id, ints] of intervalos) {
    const persona = medidas.get(id)!
    const justs = justPorPersona.get(id) ?? []
    const acc: TiempoMuertoPersona = {
      id, nombre: persona.nombre, rol: persona.rol,
      segundos: 0, justificados: 0, sinJustificacion: 0, pendientes: 0, cantidad: 0,
    }

    // Con turno se mide contra la jornada (entra lo de antes del primer PLU y
    // lo de después del último); sin turno, solo los huecos entre PLUs.
    const ventanas = ventanasPorPersona.get(id) ?? []
    const huecos = ventanas.length > 0
      ? ventanas.flatMap((v) => huecosEnVentana(ints, v, minimo))
      : detectarTiemposMuertos(ints, minimo, maximo)
    for (const h of huecos) {
      const segundos = Math.round((h.fin.getTime() - h.inicio.getTime()) / 1000)
      const { porJustificacion } = cubrirHueco(h, justs)
      // Segundos enteros por justificación, y la mayor recibe el resto del
      // redondeo y lo que quede sin cubrir por debajo de la tolerancia.
      const cubiertos = [...porJustificacion.entries()]
        .map(([jid, seg]) => ({ j: justs.find((x) => x.id === jid)!, seg: Math.round(seg) }))
        .sort((x, y) => y.seg - x.seg)
      let pendientes = segundos - cubiertos.reduce((s, c) => s + c.seg, 0)
      if (cubiertos.length > 0 && pendientes < TOLERANCIA_PENDIENTE_SEG) {
        cubiertos[0]!.seg += pendientes
        pendientes = 0
      }

      for (const c of cubiertos) {
        if (c.j.motivo === "SIN_JUSTIFICACION") acc.sinJustificacion += c.seg
        else acc.justificados += c.seg
        porMotivo.set(c.j.motivo, (porMotivo.get(c.j.motivo) ?? 0) + c.seg)
      }
      acc.pendientes += pendientes
      acc.segundos += segundos
      acc.cantidad += 1

      const principal = cubiertos[0]?.j ?? null
      tramos.push({
        usuarioId: id,
        nombre: persona.nombre,
        rol: persona.rol,
        dia: h.dia,
        inicio: h.inicio,
        fin: h.fin,
        segundos,
        estado: pendientes > 0 || !principal
          ? "pendiente"
          : principal.motivo === "SIN_JUSTIFICACION" ? "sin_justificacion" : "justificado",
        segundosPendientes: pendientes,
        justificacion: principal
          ? {
            id: principal.id,
            motivo: principal.motivo,
            observacion: principal.observacion,
            justificadoPor: principal.justificadoPor,
            justificadoAt: principal.justificadoAt,
          }
          : null,
      })
    }
    if (acc.cantidad > 0) personas.push(acc)
  }

  personas.sort((x, y) => y.segundos - x.segundos || x.nombre.localeCompare(y.nombre))
  tramos.sort((x, y) => y.inicio.getTime() - x.inicio.getTime())
  const sumar = (f: (p: TiempoMuertoPersona) => number) => personas.reduce((s, p) => s + f(p), 0)

  return {
    minimoSegundos: minimo,
    maximoSegundos: maximo,
    conTurnos: (entrada.ventanas?.length ?? 0) > 0,
    resumen: {
      segundos: sumar((p) => p.segundos),
      justificados: sumar((p) => p.justificados),
      sinJustificacion: sumar((p) => p.sinJustificacion),
      pendientes: sumar((p) => p.pendientes),
      cantidad: tramos.length,
      cantidadPendientes: tramos.filter((t) => t.estado === "pendiente").length,
    },
    personas,
    porMotivo: [...porMotivo.entries()]
      .map(([motivo, segundos]) => ({ motivo, segundos }))
      .sort((x, y) => y.segundos - x.segundos),
    tramos,
  }
}
