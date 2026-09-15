// Logica pura de Capacidad picking. Fuente de verdad y tests aqui; Nitro usa
// una copia identica en nuxt-app/server/utils/pickingCalc.ts (no puede importar
// de src/lib, y en CI los tests no pueden importar de nuxt-app). Un test compara
// los dos archivos.
export interface PickingFila { plu: string; ubicacion: string; disponible: number; concepto: 'RETIRO' | 'ALMACENAMIENTO' }
export interface PickingBase { plu: string; ubicacion: string; cajas: number; tipo: string; unidadesPorCaja: number; descripcion: string }
export interface PickingValidacion { ubicacion: string; usuarioId: string; fecha: string }
export interface PickingResultado {
  plu: string; ubicacion: string; descripcion: string; disponible: number | null;
  capacidad: number; cajasSolicitadas: number; faltantes: number; aviso: string;
  doble: boolean; ubicaciones: string[];
  tareas: { plu: string; descripcion: string; altura: string; pickingSugerido: string; unidadesSolicitadas: number }[];
}
export function textoPicking(v: unknown): string {
  return String(v ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}
export function leerTeoricoPicking(rows: readonly (readonly unknown[])[]): PickingFila[] {
  const head = rows[0]?.map(textoPicking) ?? [];
  const indices = ['ARTICULO', 'NUMERO DE DEPOSITO', 'DISPONIBLE', 'WMS AISLE'].map(h => head.indexOf(h));
  if (indices.some(i => i < 0)) throw new Error('Faltan columnas: Artículo, Número de depósito, Disponible o WMS Aisle');
  if (rows.length > 50001) throw new Error('Máximo 50.000 filas');
  const agregadas = new Map<string, PickingFila>();
  for (const [i, row] of rows.slice(1).entries()) {
    if (row.every(v => v === null || v === undefined || v === '')) continue;
    const [plu, ubicacion, cantidad, concepto] = indices.map(j => row[j]);
    const c = textoPicking(concepto), p = textoPicking(plu), u = textoPicking(ubicacion);
    const n = typeof cantidad === 'number' ? cantidad : Number(String(cantidad ?? '').trim().replace(',', '.'));
    if (!p || !u || cantidad === null || cantidad === undefined || cantidad === '' || !Number.isFinite(n) || n < 0 || n > 2147483647 || !['RETIRO', 'ALMACENAMIENTO'].includes(c)) throw new Error(`Fila ${i + 2}: PLU, ubicación, cantidad o concepto inválidos`);
    const key = JSON.stringify([p, u, c]);
    const previa = agregadas.get(key);
    if (previa) previa.disponible += n;
    else agregadas.set(key, { plu: p, ubicacion: u, disponible: n, concepto: c as PickingFila['concepto'] });
  }
  if (!agregadas.size) throw new Error('El archivo está vacío');
  return [...agregadas.values()];
}
export function calcularPicking(bases: PickingBase[], filas: PickingFila[], bloqueados: Set<string>, validaciones: Record<string, PickingValidacion> = {}): PickingResultado[] {
  const porPlu = new Map<string, PickingFila[]>();
  for (const f of filas) { const grupo = porPlu.get(f.plu) ?? []; grupo.push(f); porPlu.set(f.plu, grupo); }
  return bases.map(b => {
    const fs = porPlu.get(b.plu) ?? [], retiros = fs.filter(f => f.concepto === 'RETIRO');
    const ubicaciones = [...new Set(retiros.map(f => f.ubicacion))];
    const retiro = retiros.find(f => f.ubicacion === b.ubicacion);
    const r: PickingResultado = { plu: b.plu, ubicacion: b.ubicacion, descripcion: b.descripcion, disponible: retiro?.disponible ?? null, capacidad: b.cajas * b.unidadesPorCaja, cajasSolicitadas: 0, faltantes: 0, aviso: '', doble: ubicaciones.length > 1, ubicaciones, tareas: [] };
    if (bloqueados.has(b.plu)) { r.aviso = 'Resurtido pendiente o en ejecución'; return r; }
    if (r.doble && validaciones[b.plu]?.ubicacion !== b.ubicacion) { r.aviso = 'Pendiente por validar: doble picking'; return r; }
    if (!retiro) { r.aviso = 'Picking ausente del teórico'; return r; }
    if (!Number.isSafeInteger(b.unidadesPorCaja) || b.unidadesPorCaja <= 0) { r.aviso = 'Faltan unidades por caja en el maestro'; return r; }
    r.cajasSolicitadas = Math.max(0, Math.floor((r.capacidad - retiro.disponible) / b.unidadesPorCaja));
    let faltan = r.cajasSolicitadas;
    const alturas = fs.filter(f => f.concepto === 'ALMACENAMIENTO' && f.ubicacion !== b.ubicacion && f.disponible >= b.unidadesPorCaja).sort((a, z) => a.disponible - z.disponible || a.ubicacion.localeCompare(z.ubicacion));
    const suficiente = alturas.find(f => Math.floor(f.disponible / b.unidadesPorCaja) >= faltan);
    for (const f of suficiente ? [suficiente] : alturas) {
      const cajas = Math.min(faltan, Math.floor(f.disponible / b.unidadesPorCaja));
      if (cajas > 0) r.tareas.push({ plu: b.plu, descripcion: b.descripcion, altura: f.ubicacion, pickingSugerido: b.ubicacion, unidadesSolicitadas: cajas * b.unidadesPorCaja });
      faltan -= cajas;
      if (!faltan) break;
    }
    r.faltantes = faltan;
    r.aviso = faltan ? 'Reserva insuficiente' : !r.cajasSolicitadas ? 'Sin cajas completas por resurtir' : '';
    return r;
  });
}
