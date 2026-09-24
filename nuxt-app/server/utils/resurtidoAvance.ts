// Realización de un montaje por persona: en cuántas tareas cerradas estuvo.
//
// Reglas (CEDI, 22-09 y 24-09):
// - El porcentaje es sobre las tareas YA CERRADAS: contra el total del montaje
//   nunca cuadraba mientras hubiera pendientes.
// - Desde el 24-09 una tarea cerrada CUENTA A TODOS los que la tuvieron: si
//   Juan la empieza y Pedro la termina, les suma a los dos. Por eso la columna
//   puede pasar de 100 %. Las tareas viejas sin tramos caen en su responsable,
//   y si no hay, en el titular del montaje.

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
  /** Tareas cerradas en las que estuvo (las empezara, siguiera o terminara). */
  completadas: number
  /** Tareas en las que tuvo reloj, las haya cerrado o no. */
  participadas: number
  /** De lo cerrado, en qué parte estuvo. Lo compartido cuenta a todos: la columna puede pasar de 100. */
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
    if (vistos.size) for (const id of vistos) obtener(id).completadas++
    else if (t.responsableId) obtener(t.responsableId, t.responsable?.name).completadas++
    else obtener(m.operarioId, m.operario?.name).completadas++
  }

  return [...personas.values()]
    .map((p) => ({ ...p, porcentaje: cerradas ? Math.round((p.completadas / cerradas) * 1000) / 10 : 0 }))
    .sort((a, b) => b.completadas - a.completadas || b.participadas - a.participadas || a.nombre.localeCompare(b.nombre))
}
