// Realización de un montaje por persona: quién cerró cuántas tareas.
//
// Dos reglas (decididas con el CEDI el 22-09):
// - El porcentaje es sobre las tareas YA CERRADAS, así la columna suma 100 %.
//   Contra el total del montaje nunca cuadraba mientras hubiera pendientes, y
//   parecía que faltaba gente.
// - La tarea cuenta para QUIEN LA CERRÓ: el dueño del último tramo de reloj.
//   Si Juan la empieza y se la pasa a Pedro, es de Pedro; Juan aparece en
//   «participó en». Las tareas viejas sin tramos caen en su responsable, y si
//   no hay, en el titular del montaje.

type Tramo = { usuarioId: string; orden?: number | null; usuario?: { name: string } | null }
type Tarea = {
  estado: string
  responsableId?: string | null
  responsable?: { name: string } | null
  tramos?: Tramo[]
}

export interface AvancePersona {
  id: string
  nombre: string
  /** Tareas que cerró esta persona. */
  completadas: number
  /** Tareas en las que tuvo reloj, las haya cerrado o no. */
  participadas: number
  /** Parte de lo cerrado que es suya: la columna suma 100. */
  porcentaje: number
}

/** Dueño del último tramo por `orden`; sin tramos, `null`. */
export function quienCerro(tramos: readonly Tramo[] | undefined): Tramo | null {
  if (!tramos?.length) return null
  return [...tramos].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))[tramos.length - 1]!
}

/**
 * Porcentajes en décimas que suman exactamente 1000 (resto mayor): redondear
 * cada uno por separado daba 99,9 % o 100,1 % con datos reales.
 */
export function repartirDecimas(partes: readonly number[], total: number): number[] {
  if (total <= 0) return partes.map(() => 0)
  const exactas = partes.map((n) => (n / total) * 1000)
  const base = exactas.map(Math.floor)
  let faltan = 1000 - base.reduce((s, n) => s + n, 0)
  const porResto = exactas.map((v, i) => ({ i, resto: v - base[i]! })).sort((a, b) => b.resto - a.resto)
  for (const { i } of porResto) { if (faltan <= 0) break; base[i]!++; faltan-- }
  return base
}

export function avancePersonas(m: {
  operarioId: string
  operario?: { name: string } | null
  tareas?: Tarea[]
}): AvancePersona[] {
  const tareas = m.tareas ?? []
  const personas = new Map<string, AvancePersona>()
  const obtener = (id: string, nombre?: string | null) => {
    let p = personas.get(id)
    if (!p) { p = { id, nombre: nombre ?? id, completadas: 0, participadas: 0, porcentaje: 0 }; personas.set(id, p) }
    else if (nombre && p.nombre === id) p.nombre = nombre
    return p
  }

  // El titular aparece aunque todavía no haya cerrado nada.
  obtener(m.operarioId, m.operario?.name)

  let cerradas = 0
  for (const t of tareas) {
    const vistos = new Set<string>()
    for (const tramo of t.tramos ?? []) {
      if (vistos.has(tramo.usuarioId)) continue
      vistos.add(tramo.usuarioId)
      obtener(tramo.usuarioId, tramo.usuario?.name).participadas++
    }
    if (t.estado !== 'COMPLETADA') continue
    cerradas++
    const ultimo = quienCerro(t.tramos)
    if (ultimo) obtener(ultimo.usuarioId, ultimo.usuario?.name).completadas++
    else if (t.responsableId) obtener(t.responsableId, t.responsable?.name).completadas++
    else obtener(m.operarioId, m.operario?.name).completadas++
  }

  const lista = [...personas.values()]
  const decimas = repartirDecimas(lista.map((p) => p.completadas), cerradas)
  return lista
    .map((p, i) => ({ ...p, porcentaje: decimas[i]! / 10 }))
    .sort((a, b) => b.completadas - a.completadas || b.participadas - a.participadas || a.nombre.localeCompare(b.nombre))
}
