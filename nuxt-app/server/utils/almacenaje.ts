// Lógica de almacenaje — copia server-side de app/utils/almacenaje.ts
// (necesaria para calcular el costo acumulado en el endpoint de conteos
// sin depender del alias de cliente `~/utils`, que Nitro no resuelve).
// Gracia días 0-30 → $0. A partir del día 31, $5.000 por cada día transcurrido.
import dayjs from 'dayjs'

export const TARIFA_ALM = 5_000

export function calcCostoAlmacenaje(fechaInicio: string, endDate?: string | null): number {
  const inicio = dayjs(fechaInicio).startOf('day')
  const fin = dayjs(endDate ?? dayjs().format('YYYY-MM-DD')).startOf('day')
  const diasTranscurridos = Math.max(0, fin.diff(inicio, 'day'))
  const diasCobrados = Math.max(0, diasTranscurridos - 30)
  return diasCobrados * TARIFA_ALM
}

// Copia server-side de parseEntrega/urgencia (app/utils/guardado.ts) — solo
// el booleano "tiene alerta de entrega", no la estructura completa.
export function tieneAlertaEntrega(nota: string | null): boolean {
  if (!nota) return false
  const m = nota.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (!m) return false
  const entrega = `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`
  const dNum = dayjs(dayjs().format('YYYY-MM-DD')).diff(dayjs(entrega), 'day')
  return dNum >= -5
}
