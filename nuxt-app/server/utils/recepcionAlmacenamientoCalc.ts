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
  /** Cuantos caben en un dia en cada etapa, y la menor de las dos. */
  capacidadDescarga: number | null
  capacidadAlmacenamiento: number | null
  capacidad: number | null
  cuello: 'descarga' | 'almacenamiento' | null
}

const prom = (v: readonly number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0)

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
        capacidadDescarga,
        capacidadAlmacenamiento,
        capacidad: validas.length ? Math.min(...validas) : null,
        cuello: capacidadDescarga == null || capacidadAlmacenamiento == null
          ? null
          : capacidadAlmacenamiento <= capacidadDescarga ? 'almacenamiento' : 'descarga',
      }
    })
}
