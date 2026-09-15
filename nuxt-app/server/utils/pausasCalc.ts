/** Recorta las pausas a una ventana y une solapamientos antes de descontar. */
export function intervalosSinPausas(inicio: Date, fin: Date, pausas: { inicio: Date; fin: Date | null }[]): { inicio: Date; fin: Date }[] {
  let cursor = inicio.getTime()
  const limite = fin.getTime()
  const resultado: { inicio: Date; fin: Date }[] = []
  for (const p of [...pausas].sort((a, b) => a.inicio.getTime() - b.inicio.getTime())) {
    const desde = Math.max(cursor, p.inicio.getTime())
    const hasta = Math.min(limite, (p.fin ?? fin).getTime())
    if (hasta <= cursor || desde >= limite) continue
    if (desde > cursor) resultado.push({ inicio: new Date(cursor), fin: new Date(desde) })
    cursor = Math.max(cursor, hasta)
  }
  if (cursor < limite) resultado.push({ inicio: new Date(cursor), fin: new Date(limite) })
  return resultado
}
