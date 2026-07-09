// Lógica de almacenaje — copia server-side de app/utils/almacenaje.ts
// (necesaria para calcular el costo acumulado en el endpoint de conteos
// sin depender del alias de cliente `~/utils`, que Nitro no resuelve).
// Gracia días 0-30 → $0. Cada bloque de 30 días después → 1 cobro de $150.000.
import dayjs from 'dayjs'

export const TARIFA_ALM = 150_000

export function calcCostoAlmacenaje(fechaInicio: string, endDate?: string | null): number {
  const inicio = dayjs(fechaInicio).startOf('day')
  const fin = dayjs(endDate ?? dayjs().format('YYYY-MM-DD')).startOf('day')
  const diasTranscurridos = Math.max(0, fin.diff(inicio, 'day'))
  const cobrosGenerados = diasTranscurridos <= 30 ? 0 : Math.floor((diasTranscurridos - 31) / 30) + 1
  return cobrosGenerados * TARIFA_ALM
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
