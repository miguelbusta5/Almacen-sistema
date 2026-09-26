export const TIPOS_GARANTIA = ['INSPECCION', 'ENTREGA_TRANSPORTE', 'ANALISIS_CASO', 'OTRAS'] as const
export type TipoGarantia = typeof TIPOS_GARANTIA[number]

export function necesitaCaso(tipo: string): boolean { return tipo !== 'OTRAS' }

interface Intervalo { inicio: Date; fin: Date }

export function minutosUnicos(intervalos: Intervalo[], ventana?: Intervalo): number {
  const ordenados = intervalos.map((i) => ({
    inicio: Math.max(i.inicio.getTime(), ventana?.inicio.getTime() ?? -Infinity),
    fin: Math.min(i.fin.getTime(), ventana?.fin.getTime() ?? Infinity),
  })).filter((i) => i.fin > i.inicio).sort((a, b) => a.inicio - b.inicio)
  let total = 0
  let inicio = 0
  let fin = 0
  for (const i of ordenados) {
    if (i.inicio > fin) {
      total += Math.max(0, fin - inicio)
      inicio = i.inicio
      fin = i.fin
    } else fin = Math.max(fin, i.fin)
  }
  return (total + Math.max(0, fin - inicio)) / 60_000
}

export function minutosTarea(tramos: Intervalo[]): number {
  return tramos.reduce((s, t) => s + Math.max(0, t.fin.getTime() - t.inicio.getTime()), 0) / 60_000
}
