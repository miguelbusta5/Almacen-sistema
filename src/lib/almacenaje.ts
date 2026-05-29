// ════════════════════════════════════════════════
// LÓGICA DE ALMACENAJE
// 1 mes de gracia desde la fecha de creación.
// Pasado el mes: $150.000 COP por cada mes calendario completo.
// ════════════════════════════════════════════════

export const TARIFA_ALM = 150000;

export interface AlmacenajeGracia {
  fase: "gracia";
  meses: 0;
  costo: 0;
  diasRestantes: number;
  finGracia: string;
}

export interface AlmacenajeCobro {
  fase: "cobro";
  meses: number;
  costo: number;
  diasEnPeriodo: number;
  diasHastaProxima: number;
  costoProximo: number;
  finGracia: string;
  proximaCarga: string;
}

export type Almacenaje = AlmacenajeGracia | AlmacenajeCobro;

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Calcula el estado de almacenaje de un guardado.
 * @param fechaInicio  fecha de creación (ISO YYYY-MM-DD)
 * @param endDate      fecha tope (ISO). Si no se indica usa hoy.
 *                     Para DESPACHADOS pasar la fecha de despacho.
 */
export function calcAlmacenaje(fechaInicio: string, endDate?: string | null): Almacenaje {
  const inicio = new Date(fechaInicio + "T00:00:00");
  const fin = new Date((endDate || todayISO()) + "T00:00:00");
  const finGracia = addMonths(inicio, 1);

  if (fin <= finGracia) {
    const diasRestantes = Math.ceil((finGracia.getTime() - fin.getTime()) / 86400000);
    return { fase: "gracia", meses: 0, costo: 0, diasRestantes, finGracia: toISO(finGracia) };
  }

  // Contar meses completos de cobro
  let m = 0;
  while (addMonths(finGracia, m + 1) <= fin) m++;

  const inicioMesActual = addMonths(finGracia, m);
  const finMesActual = addMonths(finGracia, m + 1);
  const diasEnPeriodo = Math.floor((fin.getTime() - inicioMesActual.getTime()) / 86400000);
  const diasHastaProxima = Math.ceil((finMesActual.getTime() - fin.getTime()) / 86400000);

  return {
    fase: "cobro",
    meses: m,
    costo: m * TARIFA_ALM,
    diasEnPeriodo,
    diasHastaProxima,
    costoProximo: (m + 1) * TARIFA_ALM,
    finGracia: toISO(finGracia),
    proximaCarga: toISO(finMesActual),
  };
}
