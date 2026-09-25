// Recepcion de un contenedor de punta a punta: la descarga (planilla de
// Recepcion de Contenedores) + el almacenamiento (los PLU que el montacarguista
// recibe en Control Montacargas con el mismo numero de pedido, desde el 24-09).
//
// Puro (sin Prisma). No tiene gemelo en src/lib: sus tests lo cargan con
// cargarNuxt (ver src/__tests__/apoyo/nuxt.ts).
//
// Reglas (CEDI, 23-09):
// - Dos tiempos. TRABAJO = descarga + almacenamiento medido (el reloj de los
//   montacargas, sin duplicar cuando trabajan a la vez): es lo que cuesta el
//   contenedor y sirve para la capacidad. CICLO = de empezar la descarga a
//   ubicar el ultimo PLU, con esperas: cuanto tarda en quedar guardado.
// - El pedido cruza por su numero (clavePedidoRecepcion): "1921" = "PEDDM1921".
// - Un PLU es del contenedor con su mismo pedido que empezo antes que el. Si
//   el mismo pedido llega en dos contenedores, cada PLU va al ultimo abierto
//   antes de el; si ninguno empezo antes, al primero.

export interface RecepcionAlm {
  id: string
  numeroPedido: string
  tipoContenedor: string | null
  estado: string
  horaInicio: Date
  horaFinalizacion: Date | null
  pausaSegundos: number
}

export interface TramoAlm { usuarioId: string; inicio: Date; fin: Date | null }

export interface MovimientoAlm {
  id: string
  numeroPedido: string
  plu: string
  cantidadTotal: number
  estado: string
  horaInicio: Date
  horaFinalizacion: Date | null
  tramos: TramoAlm[]
  /** Del maestro de medidas; null si el PLU no esta medido (no suma cero). */
  m3: number | null
  kg: number | null
}

export interface AlmacenamientoContenedor {
  movimientos: number
  abiertos: number
  plus: number
  unidades: number
  m3: number
  kg: number
  /** PLU sin medida en el maestro: sus m3/kg no se cuentan. */
  sinMedida: number
  montacarguistas: number
  /** Quienes almacenaron: para contar personas sin repetir con los descargadores. */
  montacarguistaIds: string[]
  descargaSeg: number | null
  /** Reloj en que al menos un montacarguista estuvo con un PLU del contenedor. */
  almacenamientoRelojSeg: number
  /** Suma del tiempo de cada montacarguista (sin duplicar el suyo). */
  almacenamientoPersonaSeg: number
  /** Descarga + almacenamiento (reloj). Null si falta la descarga. */
  trabajoSeg: number | null
  /** De empezar la descarga a ubicar el ultimo PLU. Null hasta que todo cierre. */
  cicloSeg: number | null
  /** Recepcion cerrada, con PLU y todos ubicados: entra en promedios y proyeccion. */
  completo: boolean
  /**
   * EL tiempo de recepcion (25-09, el que se reporta a la direccion): de abrir
   * la descarga a dejar el ultimo PLU ubicado, sin las pausas de la planilla.
   * = descargaSeg + colaSeg, exacto al segundo. Null hasta que todo cierre.
   */
  totalSeg: number | null
  /** Lo que se tardo en ubicar lo que quedaba al cerrar la descarga (0 si ya estaba). */
  colaSeg: number | null
  /** Todas las variantes del almacenamiento, con el tiempo entre PLU (25-09). */
  desglose: DesgloseAlmacenamiento
}

/** Tiempos de UN montacarguista en un contenedor. */
export interface TiemposMontacarguista {
  usuarioId: string
  /** PLU en que trabajo (uno compartido cuenta para cada uno). */
  plus: number
  /** Con un PLU en la mano (union: dos a la vez cuentan una vez). */
  ubicandoSeg: number
  /** Entre un PLU y el siguiente: sin PLU en la mano. */
  entrePluSeg: number
  /** De su primer PLU a su ultimo = ubicando + entre PLU. */
  ventanaSeg: number
  promPluSeg: number | null
  promEntrePluSeg: number | null
  mayorHuecoSeg: number
  /** Cuantos huecos hubo entre sus PLU (para promediar entre contenedores). */
  huecos: number
}

/**
 * El almacenamiento de un contenedor por dentro. Solo cuenta desde que se abrio
 * la descarga (un PLU registrado antes no alarga el contenedor).
 * - ventana = de empezar el primer PLU a ubicar el ultimo = ubicando + entre PLU.
 * - ubicando = reloj con al menos un montacarguista con PLU en la mano.
 * - entre PLU = ventana - ubicando: nadie tenia un PLU en la mano.
 * - Por persona: lo mismo con sus propios PLU; los promedios salen de la suma
 *   de personas (por PLU = ubicando / PLU; entre PLU = huecos / cantidad de huecos).
 */
export interface DesgloseAlmacenamiento {
  ventanaSeg: number | null
  ubicandoSeg: number
  entrePluSeg: number
  mayorHuecoSeg: number
  personaUbicandoSeg: number
  personaEntrePluSeg: number
  promPluSeg: number | null
  promEntrePluSeg: number | null
  /** PLU-persona y huecos-persona: con esto se promedia entre contenedores. */
  nPlu: number
  nHuecos: number
  porMontacarguista: TiemposMontacarguista[]
}

// ── Utilidades ──────────────────────────────────────────────────────────────

type Tramo = [number, number]

/** Union de intervalos: el reloj en que hubo alguien trabajando, sin repetir. */
export function segundosUnidos(intervalos: readonly Tramo[]): number {
  const o = intervalos.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0])
  let total = 0
  let ini = -Infinity, fin = -Infinity
  for (const [a, b] of o) {
    if (a > fin) {
      if (fin > ini) total += fin - ini
      ini = a; fin = b
    } else if (b > fin) fin = b
  }
  if (fin > ini) total += fin - ini
  return Math.round(total / 1000)
}

const r = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d

/** Intervalos unidos en bloques continuos, en orden. */
export function bloquesUnidos(intervalos: readonly Tramo[]): Tramo[] {
  const o = intervalos.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0])
  const out: Tramo[] = []
  for (const [a, b] of o) {
    const u = out[out.length - 1]
    if (u && a <= u[1]) u[1] = Math.max(u[1], b)
    else out.push([a, b])
  }
  return out
}

/** Ventana, tiempo con PLU en la mano y huecos de unos bloques ya unidos. */
function partesDeBloques(bl: readonly Tramo[]) {
  const seg = (ms: number) => Math.round(ms / 1000)
  if (!bl.length) return { ventanaSeg: 0, ubicandoSeg: 0, entrePluSeg: 0, huecos: 0, mayorHuecoSeg: 0 }
  const ventana = bl[bl.length - 1]![1] - bl[0]![0]
  const ubicando = bl.reduce((s, [a, b]) => s + (b - a), 0)
  let mayor = 0
  for (let i = 1; i < bl.length; i++) mayor = Math.max(mayor, bl[i]![0] - bl[i - 1]![1])
  const ventanaSeg = seg(ventana)
  const ubicandoSeg = Math.min(ventanaSeg, seg(ubicando))
  // Por resta: ubicando + entre PLU = ventana exacto al segundo.
  return { ventanaSeg, ubicandoSeg, entrePluSeg: ventanaSeg - ubicandoSeg, huecos: bl.length - 1, mayorHuecoSeg: seg(mayor) }
}

export function desgloseAlmacenamiento(rec: RecepcionAlm, movs: readonly MovimientoAlm[]): DesgloseAlmacenamiento {
  const desde = rec.horaInicio.getTime()
  const porPersona = new Map<string, { iv: Tramo[]; movs: Set<string> }>()
  const todos: Tramo[] = []
  for (const m of movs) {
    for (const t of m.tramos) {
      if (!t.fin) continue
      const iv: Tramo = [Math.max(desde, t.inicio.getTime()), t.fin.getTime()]
      if (iv[1] <= iv[0]) continue
      todos.push(iv)
      const p = porPersona.get(t.usuarioId) ?? { iv: [], movs: new Set<string>() }
      p.iv.push(iv)
      p.movs.add(m.id)
      porPersona.set(t.usuarioId, p)
    }
  }
  const general = partesDeBloques(bloquesUnidos(todos))
  const personas = [...porPersona.entries()].map(([usuarioId, p]) => ({ usuarioId, n: p.movs.size, x: partesDeBloques(bloquesUnidos(p.iv)) }))
  const porMontacarguista: TiemposMontacarguista[] = personas.map(({ usuarioId, n, x }) => ({
    usuarioId,
    plus: n,
    ubicandoSeg: x.ubicandoSeg,
    entrePluSeg: x.entrePluSeg,
    ventanaSeg: x.ventanaSeg,
    promPluSeg: n ? Math.round(x.ubicandoSeg / n) : null,
    promEntrePluSeg: x.huecos ? Math.round(x.entrePluSeg / x.huecos) : null,
    mayorHuecoSeg: x.mayorHuecoSeg,
    huecos: x.huecos,
  })).sort((a, b) => b.plus - a.plus)
  const pu = porMontacarguista.reduce((s, x) => s + x.ubicandoSeg, 0)
  const pe = porMontacarguista.reduce((s, x) => s + x.entrePluSeg, 0)
  const nPlu = porMontacarguista.reduce((s, x) => s + x.plus, 0)
  const nHuecos = porMontacarguista.reduce((s, x) => s + x.huecos, 0)
  return {
    ventanaSeg: todos.length ? general.ventanaSeg : null,
    ubicandoSeg: general.ubicandoSeg,
    entrePluSeg: general.entrePluSeg,
    mayorHuecoSeg: general.mayorHuecoSeg,
    personaUbicandoSeg: pu,
    personaEntrePluSeg: pe,
    promPluSeg: nPlu ? Math.round(pu / nPlu) : null,
    promEntrePluSeg: nHuecos ? Math.round(pe / nHuecos) : null,
    nPlu,
    nHuecos,
    porMontacarguista,
  }
}

// ── Asignar cada PLU a su contenedor ────────────────────────────────────────

/**
 * El pedido sin su prefijo de letras: el montacarguista suele escribir solo el
 * numero ("1921") y la recepcion lo tiene completo ("PEDDM1921"). Los dos cruzan
 * por esta clave. Si no queda nada tras quitar las letras, el valor entero.
 */
export function clavePedidoRecepcion(valor: string): string {
  const v = String(valor ?? '').trim().toUpperCase().replace(/\s+/g, '')
  return v.replace(/^[A-Z]+/, '') || v
}

export function asignarMovimientos(
  recepciones: readonly RecepcionAlm[],
  movimientos: readonly MovimientoAlm[],
): { porRecepcion: Map<string, MovimientoAlm[]>; sinContenedor: MovimientoAlm[] } {
  const porPedido = new Map<string, RecepcionAlm[]>()
  for (const rec of recepciones) {
    const k = clavePedidoRecepcion(rec.numeroPedido)
    const lista = porPedido.get(k) ?? []
    lista.push(rec)
    porPedido.set(k, lista)
  }
  for (const lista of porPedido.values()) lista.sort((a, b) => a.horaInicio.getTime() - b.horaInicio.getTime())

  const porRecepcion = new Map<string, MovimientoAlm[]>(recepciones.map((x) => [x.id, []]))
  const sinContenedor: MovimientoAlm[] = []
  for (const m of movimientos) {
    const cands = porPedido.get(clavePedidoRecepcion(m.numeroPedido))
    if (!cands?.length) { sinContenedor.push(m); continue }
    const antes = cands.filter((c) => c.horaInicio.getTime() <= m.horaInicio.getTime())
    const elegida = antes.length ? antes[antes.length - 1]! : cands[0]!
    porRecepcion.get(elegida.id)!.push(m)
  }
  return { porRecepcion, sinContenedor }
}

// ── Un contenedor ───────────────────────────────────────────────────────────

export function almacenamientoContenedor(rec: RecepcionAlm, movs: readonly MovimientoAlm[]): AlmacenamientoContenedor {
  const tramos = movs.flatMap((m) => m.tramos.filter((t) => t.fin).map((t) => ({ u: t.usuarioId, iv: [t.inicio.getTime(), t.fin!.getTime()] as Tramo })))
  const porPersona = new Map<string, Tramo[]>()
  for (const t of tramos) {
    const l = porPersona.get(t.u) ?? []
    l.push(t.iv)
    porPersona.set(t.u, l)
  }
  const reloj = segundosUnidos(tramos.map((t) => t.iv))
  const persona = [...porPersona.values()].reduce((s, l) => s + segundosUnidos(l), 0)

  const descargaSeg = rec.estado === 'CERRADO' && rec.horaFinalizacion
    ? Math.max(0, Math.round((rec.horaFinalizacion.getTime() - rec.horaInicio.getTime()) / 1000 - rec.pausaSegundos))
    : null
  const abiertos = movs.filter((m) => m.estado !== 'CERRADO' || !m.horaFinalizacion).length
  const completo = descargaSeg != null && movs.length > 0 && abiertos === 0
  const ultimo = Math.max(
    rec.horaFinalizacion?.getTime() ?? 0,
    ...movs.map((m) => m.horaFinalizacion?.getTime() ?? 0),
  )
  // completo => la descarga cerro: lo que paso despues es almacenamiento pendiente.
  const colaSeg = completo ? Math.max(0, Math.round((ultimo - rec.horaFinalizacion!.getTime()) / 1000)) : null
  return {
    movimientos: movs.length,
    abiertos,
    plus: new Set(movs.map((m) => m.plu)).size,
    unidades: movs.reduce((s, m) => s + m.cantidadTotal, 0),
    m3: r(movs.reduce((s, m) => s + (m.m3 ?? 0), 0), 3),
    kg: r(movs.reduce((s, m) => s + (m.kg ?? 0), 0), 1),
    sinMedida: movs.filter((m) => m.m3 == null).length,
    montacarguistas: porPersona.size,
    montacarguistaIds: [...porPersona.keys()],
    descargaSeg,
    almacenamientoRelojSeg: reloj,
    almacenamientoPersonaSeg: persona,
    trabajoSeg: descargaSeg == null ? null : descargaSeg + reloj,
    cicloSeg: completo ? Math.round((ultimo - rec.horaInicio.getTime()) / 1000) : null,
    completo,
    totalSeg: colaSeg == null ? null : descargaSeg! + colaSeg,
    colaSeg,
    desglose: desgloseAlmacenamiento(rec, movs),
  }
}

// ── Proyeccion por tipo de contenedor ───────────────────────────────────────

export interface ProyeccionTipoContenedor {
  tipoContenedor: string
  contenedores: number
  plus: number
  unidades: number
  m3: number
  descargaMin: number
  almacenamientoMin: number
  /** Minutos-persona de montacargas por contenedor. */
  almacenamientoPersonaMin: number
  trabajoMin: number
  cicloMin: number
  /** Tiempo de recepcion promedio (ver totalSeg) y sus dos partes, en segundos. */
  totalSeg: number
  descargaSeg: number
  colaSeg: number
  /** Cuantos caben en un dia en cada etapa, y la menor de las dos. */
  capacidadDescarga: number | null
  capacidadAlmacenamiento: number | null
  capacidad: number | null
  cuello: 'descarga' | 'almacenamiento' | null
}

const prom = (v: readonly number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0)

/**
 * Promedio del tiempo de recepcion y sus dos partes, al segundo, sobre los
 * mismos contenedores: la cola sale de restar, asi descarga + cola = total
 * exacto tambien en el promedio (si no, el redondeo lo descuadra).
 */
export function partesTiempo(g: ReadonlyArray<{ totalSeg: number | null; descargaSeg: number | null }>): {
  totalSeg: number; descargaSeg: number; colaSeg: number
} {
  const c = g.filter((x) => x.totalSeg != null)
  const totalSeg = Math.round(prom(c.map((x) => x.totalSeg!)))
  const descargaSeg = Math.min(totalSeg, Math.round(prom(c.map((x) => x.descargaSeg ?? 0))))
  return { totalSeg, descargaSeg, colaSeg: totalSeg - descargaSeg }
}

/**
 * Contenedores por dia: la descarga va de a un contenedor (un muelle); el
 * almacenamiento se reparte entre los montacarguistas. Manda la etapa mas lenta.
 */
export function proyeccionContenedores(
  completos: ReadonlyArray<{ tipoContenedor: string | null; alm: AlmacenamientoContenedor }>,
  plantilla: { horas: number; montacarguistas: number },
): ProyeccionTipoContenedor[] {
  const grupos = new Map<string, AlmacenamientoContenedor[]>()
  for (const c of completos) {
    const k = c.tipoContenedor ?? 'SIN_TIPO'
    const l = grupos.get(k) ?? []
    l.push(c.alm)
    grupos.set(k, l)
  }
  const orden = ['PIES_40', 'PIES_20', 'CARGA_SUELTA', 'SIN_TIPO']
  return [...grupos.entries()]
    .sort((a, b) => orden.indexOf(a[0]) - orden.indexOf(b[0]))
    .map(([tipoContenedor, g]) => {
      const descargaMin = prom(g.map((x) => x.descargaSeg! / 60))
      const almacenamientoMin = prom(g.map((x) => x.almacenamientoRelojSeg / 60))
      const almacenamientoPersonaMin = prom(g.map((x) => x.almacenamientoPersonaSeg / 60))
      const turno = plantilla.horas * 60
      const capacidadDescarga = descargaMin > 0 ? Math.floor(turno / descargaMin) : null
      const capacidadAlmacenamiento = almacenamientoPersonaMin > 0
        ? Math.floor((plantilla.montacarguistas * turno) / almacenamientoPersonaMin) : null
      const validas = [capacidadDescarga, capacidadAlmacenamiento].filter((v): v is number => v != null)
      return {
        tipoContenedor,
        contenedores: g.length,
        plus: r(prom(g.map((x) => x.plus))),
        unidades: Math.round(prom(g.map((x) => x.unidades))),
        m3: r(prom(g.map((x) => x.m3)), 2),
        descargaMin: r(descargaMin),
        almacenamientoMin: r(almacenamientoMin),
        almacenamientoPersonaMin: r(almacenamientoPersonaMin),
        trabajoMin: r(prom(g.map((x) => x.trabajoSeg! / 60))),
        cicloMin: r(prom(g.map((x) => x.cicloSeg! / 60))),
        ...partesTiempo(g),
        capacidadDescarga,
        capacidadAlmacenamiento,
        capacidad: validas.length ? Math.min(...validas) : null,
        cuello: capacidadDescarga == null || capacidadAlmacenamiento == null
          ? null
          : capacidadAlmacenamiento <= capacidadDescarga ? 'almacenamiento' : 'descarga',
      }
    })
}
