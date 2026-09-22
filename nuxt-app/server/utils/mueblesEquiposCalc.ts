type LineaEquipo = {
  ordenId: string; plu: string; unidades: number; operarioId: string
  horaInicio: Date; horaFin: Date | null; pausaSegundos: number
  tipoEquipo?: string | null
  orden: { participantes: Array<{ usuarioId: string; equipo: { tipo: string } | null }> }
}

/** Solo picking terminado; una orden compartida puede aportar a ambos equipos. */
export function compararEquipos(lineas: LineaEquipo[]) {
  return ['GENIE', 'ORDER_PICKER'].map(tipo => {
    const filas = lineas.filter(l => l.horaFin && (l.tipoEquipo ?? l.orden.participantes.find(p => p.usuarioId === l.operarioId)?.equipo?.tipo) === tipo)
    const segundos = filas.reduce((s, l) => s + Math.max(0, (l.horaFin!.getTime() - l.horaInicio.getTime()) / 1000 - l.pausaSegundos), 0)
    const unidades = filas.reduce((s, l) => s + l.unidades, 0)
    return { tipo, ordenes: new Set(filas.map(l => l.ordenId)).size, plus: new Set(filas.map(l => l.plu)).size,
      unidades, minutos: segundos / 60, unidadesHora: segundos > 0 ? unidades * 3600 / segundos : null }
  })
}
