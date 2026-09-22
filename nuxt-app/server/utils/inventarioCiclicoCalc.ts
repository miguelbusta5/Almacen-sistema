export interface FilaInventario { plu: string; descripcion: string; ubicacion: string; disponible: number; concepto: string }
const txt = (v: unknown) => String(v ?? '').trim()
const norm = (v: unknown) => txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
function columnas(rows: unknown[][], nombres: string[]) {
  const headers = (rows[0] ?? []).map(norm)
  return nombres.map(nombre => { const n = norm(nombre); if (headers.filter(x => x === n).length !== 1) throw new Error(`Falta o se repite la columna ${nombre}`); return headers.indexOf(n) })
}
const redondear = (n: number) => Math.round(n * 1e6) / 1e6
function cantidad(v: unknown) { if ((typeof v !== 'number' && typeof v !== 'string') || txt(v) === '' || !Number.isFinite(Number(v)) || Math.abs(Number(v)) > 2147483647) throw new Error('Cantidad Disponible o Teórico inválida'); return redondear(Number(v)) }
export function leerTeoricoInventario(hoja1: unknown[][], hoja2: unknown[][]) {
  if (hoja1.length > 50001 || hoja2.length > 50001) throw new Error('Máximo 50.000 filas por hoja')
  const [p, d, u, c, a] = columnas(hoja1, ['Artículo', 'Nombre para mostrar', 'Número de depósito', 'Disponible', 'WMS Aisle']) as [number,number,number,number,number]
  const filas = new Map<string, FilaInventario>()
  const conExistencia = new Set<string>()
  for (const row of hoja1.slice(1)) {
    if (!row.some(v => txt(v))) continue
    const plu = norm(row[p]), ubicacion = norm(row[u]), concepto = norm(row[a])
    if (!plu || plu.length > 100 || ubicacion.length > 120 || (concepto === 'RETIRO' && !ubicacion)) throw new Error('PLU o ubicación RETIRO inválida')
    const key = JSON.stringify([plu, ubicacion, concepto]), disponible = cantidad(row[c])
    if (disponible !== 0) conExistencia.add(plu)
    const anterior = filas.get(key)
    if (anterior) anterior.disponible = redondear(anterior.disponible + disponible)
    else filas.set(key, { plu, ubicacion, concepto, disponible, descripcion: txt(row[d]) })
  }
  const [ip, it] = columnas(hoja2, ['Nombre', 'Teorico']) as [number,number]
  const teorico: Record<string, number> = Object.create(null)
  const alcance = new Set([...filas.values()].map(f => f.plu))
  const fueraAlcance = new Set<string>()
  for (const row of hoja2.slice(1)) {
    if (!row.some(v => txt(v))) continue
    const plu = norm(row[ip]); if (!plu || plu.length > 100) throw new Error('PLU inválido en hoja 2')
    if (!alcance.has(plu)) { fueraAlcance.add(plu); continue }
    if (txt(row[it]) === '') throw new Error(`Completa el teórico de hoja 2 para el PLU ${plu}; un vacío no equivale a cero`)
    teorico[plu] = redondear((teorico[plu] ?? 0) + cantidad(row[it]))
  }
  const lista = [...filas.values()]
  if (!lista.some(f => f.concepto === 'RETIRO')) throw new Error('No hay ubicaciones RETIRO para contar')
  const faltantes = [...new Set(lista.map(f => f.plu))].filter(plu => teorico[plu] === undefined)
  const bloqueantes = faltantes.filter(plu => conExistencia.has(plu))
  if (bloqueantes.length) throw new Error(`PLU sin teórico en hoja 2: ${bloqueantes.slice(0, 10).join(', ')}`)
  const excluidos = new Set(faltantes)
  const avisos = faltantes.map(plu => ({ plu, descripcion: lista.find(f => f.plu === plu)!.descripcion, ubicaciones: [...new Set(lista.filter(f => f.plu === plu).map(f => f.ubicacion).filter(Boolean))], motivo: 'Excluido: sin teórico en hoja 2 y disponible cero.' }))
  return { filas: lista.filter(f => !excluidos.has(f.plu)), teorico, avisos, fueraAlcance: [...fueraAlcance], ubicaciones: [...new Set(lista.filter(f => !excluidos.has(f.plu) && f.concepto === 'RETIRO').map(f => f.ubicacion))] }
}
export function fisicoInventario(cajas: number, empaque: number, reguero: number) {
  if (![cajas, empaque, reguero].every(n => Number.isSafeInteger(n) && n >= 0) || empaque < 1) throw new Error('Cajas y reguero deben ser enteros no negativos; empaque mayor que cero')
  const total = cajas * empaque + reguero
  if (!Number.isSafeInteger(total) || total > 2147483647) throw new Error('Cantidad fuera del límite')
  return total
}
export const estadoInventario = (fisico: number, teorico: number) => redondear(fisico - teorico) === 0 ? 'OK' : fisico < teorico ? 'FALTANTE' : 'SOBRANTE'
export function consolidarInventario(filas: FilaInventario[], teorico: Record<string, number>, conteos: { ubicacion: string; plu: string; fisico: number }[]) {
  const fisico = new Map<string, number>()
  for (const f of filas) if (f.concepto !== 'RETIRO') fisico.set(f.plu, (fisico.get(f.plu) ?? 0) + f.disponible)
  for (const c of conteos) fisico.set(c.plu, (fisico.get(c.plu) ?? 0) + c.fisico)
  return [...new Set([...filas.map(f => f.plu), ...fisico.keys()])].sort().map(plu => {
    const t = teorico[plu] ?? 0, f = redondear(fisico.get(plu) ?? 0)
    return { plu, teorico: t, fisico: f, diferencia: redondear(f - t), estado: estadoInventario(f, t) }
  })
}
