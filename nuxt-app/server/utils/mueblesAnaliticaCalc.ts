// Analitica de muebles: el tablero de picking + inspeccion + entrega.
//
// Puro (sin Prisma): recibe filas ya leidas y lo calcula todo en una pasada, lo
// que lo hace testeable sin base de datos. No tiene gemelo en src/lib: sus
// tests lo cargan con cargarNuxt (ver src/__tests__/apoyo/nuxt.ts).
//
// Reglas (decididas con el CEDI el 23-09):
// - "Completada" se muestra de dos formas: inspeccionada (termino inspeccion) y
//   entregada a transporte (salio del CEDI).
// - La proyeccion es por CAPACIDAD y por tipo de orden: el tiempo de trabajo
//   real (picking + inspeccion, sin colas) contra la gente que hubo, en un
//   turno de 9 h de lunes a jueves y 8 h el viernes. Una TSDM (6 PLU de
//   promedio) y una OVDM (1,3) no pesan lo mismo, por eso va por tipo.
// - Los promedios por dia son por DIA CON ACTIVIDAD, no por dias del rango: un
//   domingo sin nadie no es un dia flojo.
// - La capacidad se calcula con la PLANTILLA del turno (2 operarios y 5
//   inspectores, dato del CEDI), no con quien aparecio en los registros: quien
//   hizo un solo PLU contaba como un dia entero. Lo observado va de referencia.
// - Solo es picking lo que hizo un usuario de picking. El login compartido de
//   inspeccion ("MUEBLES") agrega PLU a la orden con 0 s de picking: no es un
//   operario y no entra en el conteo, las horas pico ni el top de PLU.

import { diaBogota } from './indicadoresCalc'

// ── Entrada ─────────────────────────────────────────────────────────────────

export interface LineaAnalitica {
  ordenId: string
  /** Lo hizo un usuario de picking (no el login de inspeccion que agrega PLU). */
  esPicking: boolean
  plu: string
  descripcion: string | null
  unidades: number
  operarioId: string
  horaInicio: Date
  horaFin: Date | null
  pausaSegundos: number
  inspectorId: string | null
  inspHoraInicio: Date | null
  inspHoraFin: Date | null
  /** Minutos de inspeccion YA repartidos (inspeccionRepartida), sin colas ni taller. */
  inspMin: number | null
  ebanisteriaInicio: Date | null
  averiado: boolean
  volumenTotalM3: number | null
  pesoTotalKg: number | null
}

export interface OrdenAnalitica {
  id: string
  codigo: string
  tipoOrden: string
  estado: string
  horaInicio: Date
  horaPasoInspeccion: Date | null
  horaFinInspeccion: Date | null
  entregadaTransporteAt: Date | null
  ciudadEnvio: string | null
  pausaSegundos: number
  lineas: LineaAnalitica[]
  errores: number
  pendientes: number
}

// ── Constantes ──────────────────────────────────────────────────────────────

/** Horas de turno por dia ISO (1 = lunes). Sabado y domingo no hay turno. */
export const JORNADA_MUEBLES_HORAS: Readonly<Record<number, number>> = { 1: 9, 2: 9, 3: 9, 4: 9, 5: 8 }

/** TIENDA = OVDM/TSDM que llega de tienda: sin picking en el CEDI, se mide aparte. */
export const TIPOS_ORDEN_MUEBLES = ['TSDM', 'OVDM', 'TIENDA', 'CONTADO'] as const

/** Plantilla del turno de muebles (CEDI, 23-09). La pantalla deja simular otra. */
export const PLANTILLA_MUEBLES_DEFECTO = { operarios: 2, inspectores: 5 } as const
export const MAX_PLANTILLA_MUEBLES = 30

/** Etapas del proceso, en orden: lo que se usa para ver donde se detiene. */
export const ETAPAS_MUEBLES = [
  { key: 'picking', label: 'Picking' },
  { key: 'esperaInspeccion', label: 'Espera a inspección' },
  { key: 'inspeccion', label: 'Inspección' },
  { key: 'esperaEntrega', label: 'Espera a entrega' },
] as const
export type EtapaMuebles = (typeof ETAPAS_MUEBLES)[number]['key']

/** Heatmap: de 5 a 22 h (Bogota) cubre los dos turnos; fuera casi no hay nada. */
export const HORA_PICO_DESDE = 5
export const HORA_PICO_HASTA = 22

// ── Salida ──────────────────────────────────────────────────────────────────

export interface DiaAnalitica {
  dia: string
  /** 1 = lunes … 7 = domingo. */
  diaSemana: number
  inspeccionadas: number
  entregadas: number
  m3Entregado: number
  kgEntregado: number
}

export interface OrdenCompletada {
  id: string
  codigo: string
  tipoOrden: string
  estado: string
  ciudad: string | null
  plus: number
  unidades: number
  pickingMin: number | null
  esperaInspeccionMin: number | null
  /** Reloj de pared: del primer PLU inspeccionado al ultimo. */
  inspeccionRelojMin: number | null
  /** Trabajo real de los inspectores (repartido): lo que cuenta para capacidad. */
  inspeccionTrabajoMin: number | null
  esperaEntregaMin: number | null
  leadTimeMin: number | null
  inspeccionadaAt: string | null
  entregadaAt: string | null
  errores: number
  ebanisteria: boolean
  averia: boolean
  pendientes: number
}

export interface EtapaResumen {
  key: EtapaMuebles
  label: string
  ordenes: number
  promedioMin: number | null
  medianaMin: number | null
}

export interface PluTop {
  plu: string
  descripcion: string | null
  veces: number
  ordenes: number
  unidades: number
  promedioPickingMin: number | null
}

export interface CiudadResumen {
  ciudad: string
  ordenes: number
  promedioDia: number
  porcentaje: number
  m3: number
  kg: number
}

export interface CapacidadTipo {
  tipoOrden: string
  /** Ordenes con los dos tiempos medidos: la base del promedio. */
  muestra: number
  /** Parte de la mezcla real (0-100). */
  porcentajeMezcla: number
  plusPorOrden: number
  pickingMin: number | null
  inspeccionMin: number | null
  /** Si TODO el dia fuera de este tipo, cuantas caben en un turno de 9 h. */
  capacidad9h: number | null
}

export interface JornadaProyectada {
  etiqueta: string
  horas: number
  dias: number
  capacidadPicking: number | null
  capacidadInspeccion: number | null
  /** La menor de las dos: el proceso no va mas rapido que su etapa mas lenta. */
  capacidad: number | null
}

export interface Proyeccion {
  /** Con esta gente se calcula la capacidad. */
  plantilla: { operarios: number; inspectores: number }
  /** Los que aparecieron en los registros, por dia con actividad (referencia). */
  operariosDia: number | null
  inspectoresDia: number | null
  /** Minutos por orden con la mezcla real de tipos. */
  pickingMinMezcla: number | null
  inspeccionMinMezcla: number | null
  jornadas: JornadaProyectada[]
  semana: number | null
  cuello: 'picking' | 'inspeccion' | null
  porTipo: CapacidadTipo[]
  /** Lo que se hizo de verdad: inspeccionadas por dia con actividad. */
  realDia: number | null
  /** Parte del turno que se fue en trabajo medido (0-100). */
  ocupacionPicking: number | null
  ocupacionInspeccion: number | null
}

export interface HorasPico {
  /** [diaSemana 1-6][hora] = PLU pickeados. */
  celdas: Array<{ diaSemana: number; hora: number; plus: number }>
  maximo: number
  porHora: Array<{ hora: number; plus: number; ordenes: number }>
  porDiaSemana: Array<{ diaSemana: number; plus: number; ordenes: number; dias: number; promedioOrdenes: number }>
}

export interface Calidad {
  ordenes: number
  conError: number
  conEbanisteria: number
  conAveria: number
  conPendientes: number
  perfectas: number
}

export interface MezclaTipo {
  tipoOrden: string
  ordenes: number
  porcentaje: number
  plusPorOrden: number
  m3: number
  kg: number
}

export interface AnaliticaMuebles {
  resumen: {
    inspeccionadas: number
    entregadas: number
    diasActivos: number
    inspeccionadasDia: number | null
    entregadasDia: number | null
    leadTimeMedianaMin: number | null
    plusPickeados: number
    m3Entregado: number
    kgEntregado: number
  }
  dias: DiaAnalitica[]
  ordenes: OrdenCompletada[]
  etapas: EtapaResumen[]
  topPlus: PluTop[]
  ciudades: CiudadResumen[]
  proyeccion: Proyeccion
  horasPico: HorasPico
  calidad: Calidad
  mezcla: MezclaTipo[]
}

// ── Utilidades ──────────────────────────────────────────────────────────────

const MS_MIN = 60_000
const DESFASE_BOGOTA_MS = -5 * 60 * 60 * 1000

function r(v: number, d = 1): number {
  const f = 10 ** d
  return Math.round(v * f) / f
}

function minEntre(a: Date | null | undefined, b: Date | null | undefined, menosSeg = 0): number | null {
  if (!a || !b) return null
  return r(Math.max(0, (b.getTime() - a.getTime()) / MS_MIN - menosSeg / 60), 2)
}

function prom(v: readonly number[]): number | null {
  return v.length ? r(v.reduce((s, x) => s + x, 0) / v.length, 2) : null
}

export function medianaMuebles(v: readonly number[]): number | null {
  if (!v.length) return null
  const o = [...v].sort((a, b) => a - b)
  const m = Math.floor(o.length / 2)
  return r(o.length % 2 ? o[m]! : (o[m - 1]! + o[m]!) / 2, 2)
}

/** Dia ISO de la semana de un YYYY-MM-DD (1 = lunes … 7 = domingo). */
export function diaSemanaIso(dia: string): number {
  const d = new Date(`${dia}T12:00:00Z`).getUTCDay()
  return d === 0 ? 7 : d
}

function horaBogota(d: Date): number {
  return new Date(d.getTime() + DESFASE_BOGOTA_MS).getUTCHours()
}

function diasEntre(desde: string, hasta: string): string[] {
  const out: string[] = []
  for (let t = new Date(`${desde}T12:00:00Z`).getTime(); ; t += 86_400_000) {
    const d = new Date(t).toISOString().slice(0, 10)
    if (d > hasta) break
    out.push(d)
  }
  return out
}

function dentro(d: Date | null, desde: string, hasta: string): d is Date {
  if (!d) return false
  const dia = diaBogota(d)
  return dia >= desde && dia <= hasta
}

// ── Por orden ───────────────────────────────────────────────────────────────

export function medirOrden(o: OrdenAnalitica): OrdenCompletada {
  const iniciosInsp = o.lineas.map((l) => l.inspHoraInicio).filter((d): d is Date => !!d)
  const primerInsp = iniciosInsp.length ? new Date(Math.min(...iniciosInsp.map((d) => d.getTime()))) : null
  const trabajo = o.lineas.map((l) => l.inspMin).filter((v): v is number => v != null)
  return {
    id: o.id,
    codigo: o.codigo,
    tipoOrden: o.tipoOrden,
    estado: o.estado,
    ciudad: o.ciudadEnvio,
    plus: o.lineas.length,
    unidades: o.lineas.reduce((s, l) => s + l.unidades, 0),
    pickingMin: minEntre(o.horaInicio, o.horaPasoInspeccion, o.pausaSegundos),
    esperaInspeccionMin: minEntre(o.horaPasoInspeccion, primerInsp),
    inspeccionRelojMin: minEntre(primerInsp, o.horaFinInspeccion),
    inspeccionTrabajoMin: trabajo.length ? r(trabajo.reduce((s, x) => s + x, 0), 2) : null,
    esperaEntregaMin: minEntre(o.horaFinInspeccion, o.entregadaTransporteAt),
    leadTimeMin: minEntre(o.horaInicio, o.entregadaTransporteAt),
    inspeccionadaAt: o.horaFinInspeccion?.toISOString() ?? null,
    entregadaAt: o.entregadaTransporteAt?.toISOString() ?? null,
    errores: o.errores,
    ebanisteria: o.lineas.some((l) => l.ebanisteriaInicio != null),
    averia: o.lineas.some((l) => l.averiado),
    pendientes: o.pendientes,
  }
}

// ── Proyeccion ──────────────────────────────────────────────────────────────

/**
 * Cuantas ordenes caben en un turno: por cada etapa, (personas x minutos de
 * turno) / minutos de trabajo por orden. La capacidad del dia es la menor de
 * las dos: el proceso no sale mas rapido que su etapa mas lenta.
 */
export function capacidadTurno(entrada: {
  horas: number
  operarios: number | null
  inspectores: number | null
  pickingMin: number | null
  inspeccionMin: number | null
}): { picking: number | null; inspeccion: number | null; capacidad: number | null } {
  const cap = (personas: number | null, min: number | null) =>
    personas && min && min > 0 ? Math.floor((personas * entrada.horas * 60) / min) : null
  const picking = cap(entrada.operarios, entrada.pickingMin)
  const inspeccion = cap(entrada.inspectores, entrada.inspeccionMin)
  const validos = [picking, inspeccion].filter((v): v is number => v != null)
  return { picking, inspeccion, capacidad: validos.length ? Math.min(...validos) : null }
}

// ── Todo el tablero ─────────────────────────────────────────────────────────

export function analiticaMuebles(entrada: {
  ordenes: readonly OrdenAnalitica[]
  /** PLU con el picking EMPEZADO en el rango (top de PLU, horas pico, personal). */
  lineasPeriodo: readonly LineaAnalitica[]
  desde: string
  hasta: string
  plantilla?: { operarios: number; inspectores: number }
}): AnaliticaMuebles {
  const { desde, hasta } = entrada
  const plantilla = entrada.plantilla ?? { ...PLANTILLA_MUEBLES_DEFECTO }
  // Picking de verdad: sin los PLU que agrega el login de inspeccion.
  const picking = entrada.lineasPeriodo.filter((l) => l.esPicking)
  const inspeccionadas = entrada.ordenes.filter((o) => dentro(o.horaFinInspeccion, desde, hasta))
  const entregadas = entrada.ordenes.filter((o) => dentro(o.entregadaTransporteAt, desde, hasta))
  const medidas = new Map(entrada.ordenes.map((o) => [o.id, medirOrden(o)]))
  const volumen = (o: OrdenAnalitica) => o.lineas.reduce((s, l) => s + (l.volumenTotalM3 ?? 0), 0)
  const peso = (o: OrdenAnalitica) => o.lineas.reduce((s, l) => s + (l.pesoTotalKg ?? 0), 0)

  // ── Serie diaria ──
  const dias: DiaAnalitica[] = diasEntre(desde, hasta).map((dia) => ({
    dia, diaSemana: diaSemanaIso(dia), inspeccionadas: 0, entregadas: 0, m3Entregado: 0, kgEntregado: 0,
  }))
  const porDia = new Map(dias.map((d) => [d.dia, d]))
  for (const o of inspeccionadas) porDia.get(diaBogota(o.horaFinInspeccion!))!.inspeccionadas++
  for (const o of entregadas) {
    const d = porDia.get(diaBogota(o.entregadaTransporteAt!))!
    d.entregadas++
    d.m3Entregado = r(d.m3Entregado + volumen(o), 3)
    d.kgEntregado = r(d.kgEntregado + peso(o), 1)
  }
  const diasActivos = dias.filter((d) => d.inspeccionadas > 0 || d.entregadas > 0)
  const diasConInspeccion = dias.filter((d) => d.inspeccionadas > 0).length
  const diasConEntrega = dias.filter((d) => d.entregadas > 0).length

  // ── Ordenes completadas (inspeccionadas o entregadas en el rango) ──
  const completadasIds = new Set([...inspeccionadas, ...entregadas].map((o) => o.id))
  const ordenes = entrada.ordenes
    .filter((o) => completadasIds.has(o.id))
    .map((o) => medidas.get(o.id)!)
    .sort((a, b) => (b.entregadaAt ?? b.inspeccionadaAt ?? '').localeCompare(a.entregadaAt ?? a.inspeccionadaAt ?? ''))

  // ── Etapas: donde se detiene la orden ──
  const valores: Record<EtapaMuebles, number[]> = { picking: [], esperaInspeccion: [], inspeccion: [], esperaEntrega: [] }
  for (const m of ordenes) {
    if (m.pickingMin != null) valores.picking.push(m.pickingMin)
    if (m.esperaInspeccionMin != null) valores.esperaInspeccion.push(m.esperaInspeccionMin)
    if (m.inspeccionRelojMin != null) valores.inspeccion.push(m.inspeccionRelojMin)
    if (m.esperaEntregaMin != null) valores.esperaEntrega.push(m.esperaEntregaMin)
  }
  const etapas: EtapaResumen[] = ETAPAS_MUEBLES.map((e) => ({
    key: e.key, label: e.label, ordenes: valores[e.key].length,
    promedioMin: prom(valores[e.key]), medianaMin: medianaMuebles(valores[e.key]),
  }))

  // ── PLU mas pickeados ──
  const plus = new Map<string, { descripcion: string | null; veces: number; ordenes: Set<string>; unidades: number; min: number[] }>()
  for (const l of picking) {
    const p = plus.get(l.plu) ?? { descripcion: l.descripcion, veces: 0, ordenes: new Set<string>(), unidades: 0, min: [] }
    p.veces++
    p.ordenes.add(l.ordenId)
    p.unidades += l.unidades
    p.descripcion ??= l.descripcion
    const m = minEntre(l.horaInicio, l.horaFin, l.pausaSegundos)
    if (m != null) p.min.push(m)
    plus.set(l.plu, p)
  }
  const topPlus: PluTop[] = [...plus.entries()]
    .map(([plu, p]) => ({
      plu, descripcion: p.descripcion, veces: p.veces, ordenes: p.ordenes.size,
      unidades: p.unidades, promedioPickingMin: prom(p.min),
    }))
    .sort((a, b) => b.veces - a.veces || b.unidades - a.unidades || a.plu.localeCompare(b.plu))
    .slice(0, 25)

  // ── Ciudades (entregadas a transporte) ──
  const ciudadesMap = new Map<string, { n: number; m3: number; kg: number }>()
  for (const o of entregadas) {
    const k = o.ciudadEnvio?.trim() || 'SIN CIUDAD'
    const c = ciudadesMap.get(k) ?? { n: 0, m3: 0, kg: 0 }
    c.n++
    c.m3 += volumen(o)
    c.kg += peso(o)
    ciudadesMap.set(k, c)
  }
  const ciudades: CiudadResumen[] = [...ciudadesMap.entries()]
    .map(([ciudad, c]) => ({
      ciudad, ordenes: c.n,
      promedioDia: diasConEntrega ? r(c.n / diasConEntrega) : 0,
      porcentaje: entregadas.length ? r((c.n / entregadas.length) * 100) : 0,
      m3: r(c.m3, 3), kg: r(c.kg, 1),
    }))
    .sort((a, b) => b.ordenes - a.ordenes || a.ciudad.localeCompare(b.ciudad))

  // ── Personal por dia (para la capacidad) ──
  const operariosPorDia = new Map<string, Set<string>>()
  for (const l of picking) {
    const d = diaBogota(l.horaInicio)
    const s = operariosPorDia.get(d) ?? new Set<string>()
    s.add(l.operarioId)
    operariosPorDia.set(d, s)
  }
  const inspectoresPorDia = new Map<string, Set<string>>()
  for (const o of entrada.ordenes) {
    for (const l of o.lineas) {
      if (!l.inspectorId || !dentro(l.inspHoraFin, desde, hasta)) continue
      const d = diaBogota(l.inspHoraFin!)
      const s = inspectoresPorDia.get(d) ?? new Set<string>()
      s.add(l.inspectorId)
      inspectoresPorDia.set(d, s)
    }
  }
  const promPersonas = (m: Map<string, Set<string>>) =>
    m.size ? r([...m.values()].reduce((s, x) => s + x.size, 0) / m.size) : null
  const operariosDia = promPersonas(operariosPorDia)
  const inspectoresDia = promPersonas(inspectoresPorDia)

  // ── Proyeccion por capacidad y tipo ──
  const base = inspeccionadas.map((o) => medidas.get(o.id)!).filter((m) => m.pickingMin != null && m.inspeccionTrabajoMin != null)
  const tipos = [...new Set([...TIPOS_ORDEN_MUEBLES, ...base.map((m) => m.tipoOrden)])]
  const porTipo: CapacidadTipo[] = tipos
    .map((tipoOrden) => {
      const g = base.filter((m) => m.tipoOrden === tipoOrden)
      const pickingMin = prom(g.map((m) => m.pickingMin!))
      const inspeccionMin = prom(g.map((m) => m.inspeccionTrabajoMin!))
      return {
        tipoOrden,
        muestra: g.length,
        porcentajeMezcla: base.length ? r((g.length / base.length) * 100) : 0,
        plusPorOrden: g.length ? r(g.reduce((s, m) => s + m.plus, 0) / g.length) : 0,
        pickingMin,
        inspeccionMin,
        capacidad9h: capacidadTurno({ horas: 9, operarios: plantilla.operarios, inspectores: plantilla.inspectores, pickingMin, inspeccionMin }).capacidad,
      }
    })
    .filter((t) => t.muestra > 0)
  // Con la mezcla real: el promedio ponderado es el promedio de toda la base.
  const pickingMinMezcla = prom(base.map((m) => m.pickingMin!))
  const inspeccionMinMezcla = prom(base.map((m) => m.inspeccionTrabajoMin!))
  const jornadas: JornadaProyectada[] = [
    { etiqueta: 'Lunes a jueves', horas: 9, dias: 4 },
    { etiqueta: 'Viernes', horas: 8, dias: 1 },
  ].map((j) => {
    const c = capacidadTurno({ horas: j.horas, operarios: plantilla.operarios, inspectores: plantilla.inspectores, pickingMin: pickingMinMezcla, inspeccionMin: inspeccionMinMezcla })
    return { ...j, capacidadPicking: c.picking, capacidadInspeccion: c.inspeccion, capacidad: c.capacidad }
  })
  const semana = jornadas.every((j) => j.capacidad != null)
    ? jornadas.reduce((s, j) => s + j.capacidad! * j.dias, 0)
    : null
  const j9 = jornadas[0]!
  const cuello = j9.capacidadPicking == null || j9.capacidadInspeccion == null
    ? null
    : j9.capacidadInspeccion <= j9.capacidadPicking ? 'inspeccion' : 'picking'

  // Ocupacion: minutos medidos contra (plantilla x horas del turno de ese dia),
  // en los dias habiles con actividad.
  const ocupacion = (minPorDia: Map<string, number>, personas: number) => {
    let usado = 0, disponible = 0
    for (const [dia, min] of minPorDia) {
      const horas = JORNADA_MUEBLES_HORAS[diaSemanaIso(dia)]
      if (!horas) continue
      usado += min
      disponible += personas * horas * 60
    }
    return disponible > 0 ? r((usado / disponible) * 100) : null
  }
  const pickPorDia = new Map<string, number>()
  for (const l of picking) {
    const m = minEntre(l.horaInicio, l.horaFin, l.pausaSegundos)
    if (m != null) pickPorDia.set(diaBogota(l.horaInicio), (pickPorDia.get(diaBogota(l.horaInicio)) ?? 0) + m)
  }
  const inspPorDia = new Map<string, number>()
  for (const o of entrada.ordenes) {
    for (const l of o.lineas) {
      if (l.inspMin == null || !dentro(l.inspHoraFin, desde, hasta)) continue
      const d = diaBogota(l.inspHoraFin!)
      inspPorDia.set(d, (inspPorDia.get(d) ?? 0) + l.inspMin)
    }
  }

  const proyeccion: Proyeccion = {
    plantilla,
    operariosDia,
    inspectoresDia,
    pickingMinMezcla,
    inspeccionMinMezcla,
    jornadas,
    semana,
    cuello,
    porTipo,
    realDia: diasConInspeccion ? r(inspeccionadas.length / diasConInspeccion) : null,
    ocupacionPicking: ocupacion(pickPorDia, plantilla.operarios),
    ocupacionInspeccion: ocupacion(inspPorDia, plantilla.inspectores),
  }

  // ── Horas pico: PLU pickeados por dia de la semana y hora ──
  const celdas = new Map<string, number>()
  const porHora = new Map<number, { plus: number; ordenes: Set<string> }>()
  const porDiaSemana = new Map<number, { plus: number; ordenes: Set<string>; dias: Set<string> }>()
  for (const l of picking) {
    const ds = diaSemanaIso(diaBogota(l.horaInicio))
    const h = horaBogota(l.horaInicio)
    celdas.set(`${ds}|${h}`, (celdas.get(`${ds}|${h}`) ?? 0) + 1)
    const ph = porHora.get(h) ?? { plus: 0, ordenes: new Set<string>() }
    ph.plus++
    ph.ordenes.add(l.ordenId)
    porHora.set(h, ph)
    const pd = porDiaSemana.get(ds) ?? { plus: 0, ordenes: new Set<string>(), dias: new Set<string>() }
    pd.plus++
    pd.ordenes.add(l.ordenId)
    pd.dias.add(diaBogota(l.horaInicio))
    porDiaSemana.set(ds, pd)
  }
  const horas = Array.from({ length: HORA_PICO_HASTA - HORA_PICO_DESDE + 1 }, (_, i) => HORA_PICO_DESDE + i)
  const horasPico: HorasPico = {
    celdas: [1, 2, 3, 4, 5, 6].flatMap((diaSemana) =>
      horas.map((hora) => ({ diaSemana, hora, plus: celdas.get(`${diaSemana}|${hora}`) ?? 0 }))),
    maximo: Math.max(0, ...celdas.values()),
    porHora: horas.map((hora) => ({ hora, plus: porHora.get(hora)?.plus ?? 0, ordenes: porHora.get(hora)?.ordenes.size ?? 0 })),
    porDiaSemana: [1, 2, 3, 4, 5, 6].map((diaSemana) => {
      const pd = porDiaSemana.get(diaSemana)
      const n = pd?.dias.size ?? 0
      return {
        diaSemana, plus: pd?.plus ?? 0, ordenes: pd?.ordenes.size ?? 0, dias: n,
        promedioOrdenes: n ? r((pd?.ordenes.size ?? 0) / n) : 0,
      }
    }),
  }

  // ── Calidad (sobre las inspeccionadas del periodo) ──
  const q = inspeccionadas.map((o) => medidas.get(o.id)!)
  const calidad: Calidad = {
    ordenes: q.length,
    conError: q.filter((m) => m.errores > 0).length,
    conEbanisteria: q.filter((m) => m.ebanisteria).length,
    conAveria: q.filter((m) => m.averia).length,
    conPendientes: q.filter((m) => m.pendientes > 0).length,
    perfectas: q.filter((m) => !m.errores && !m.ebanisteria && !m.averia && !m.pendientes).length,
  }

  // ── Mezcla (sobre las completadas) ──
  const completadas = entrada.ordenes.filter((o) => completadasIds.has(o.id))
  const mezcla: MezclaTipo[] = tipos
    .map((tipoOrden) => {
      const g = completadas.filter((o) => o.tipoOrden === tipoOrden)
      return {
        tipoOrden,
        ordenes: g.length,
        porcentaje: completadas.length ? r((g.length / completadas.length) * 100) : 0,
        plusPorOrden: g.length ? r(g.reduce((s, o) => s + o.lineas.length, 0) / g.length) : 0,
        m3: r(g.reduce((s, o) => s + volumen(o), 0), 3),
        kg: r(g.reduce((s, o) => s + peso(o), 0), 1),
      }
    })
    .filter((t) => t.ordenes > 0)

  const leads = ordenes.map((m) => m.leadTimeMin).filter((v): v is number => v != null)
  return {
    resumen: {
      inspeccionadas: inspeccionadas.length,
      entregadas: entregadas.length,
      diasActivos: diasActivos.length,
      inspeccionadasDia: diasConInspeccion ? r(inspeccionadas.length / diasConInspeccion) : null,
      entregadasDia: diasConEntrega ? r(entregadas.length / diasConEntrega) : null,
      leadTimeMedianaMin: medianaMuebles(leads),
      plusPickeados: picking.length,
      m3Entregado: r(entregadas.reduce((s, o) => s + volumen(o), 0), 3),
      kgEntregado: r(entregadas.reduce((s, o) => s + peso(o), 0), 1),
    },
    dias,
    ordenes,
    etapas,
    topPlus,
    ciudades,
    proyeccion,
    horasPico,
    calidad,
    mezcla,
  }
}
