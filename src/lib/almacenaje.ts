// ════════════════════════════════════════════════
// LÓGICA DE ALMACENAJE — Regla de 30 días exactos
//
// Período de gracia: días 0-30 (inclusive) → $0
// Cada bloque completo de 30 días DESPUÉS de la gracia → 1 cobro
//
// Ejemplos:
//   Días  0-30 → 0 cobros ($0)
//   Días 31-60 → 1 cobro  ($150.000)
//   Días 61-90 → 2 cobros ($300.000)
//   Días 91-120→ 3 cobros ($450.000)
//
// Sin prorrateo. Cada cobro es el bloque completo.
// ════════════════════════════════════════════════

export const TARIFA_ALM = 150_000; // $150.000 COP por período de 30 días

export interface Almacenaje {
  // ── Campos nuevos (spec correcta) ────────────────────────
  diasTranscurridos:     number;
  diasGraciaRestantes:   number;   // 0 si ya venció la gracia
  cobrosGenerados:       number;
  costoAcumulado:        number;
  fechaPrimerCobro:      string;   // YYYY-MM-DD (día 31 desde ingreso)
  fechaProximoCobro:     string;   // YYYY-MM-DD (próximo cobro)
  diasHastaProximoCobro: number;

  // ── Aliases de compatibilidad (código existente) ─────────
  fase:           "gracia" | "cobro";
  costo:          number;   // = costoAcumulado
  meses:          number;   // = cobrosGenerados
  finGracia:      string;   // fecha en que termina el período de gracia (día 30)
  diasRestantes:  number;   // = diasGraciaRestantes
  costoProximo:   number;   // costo al completar el próximo bloque
  diasHastaProxima: number; // = diasHastaProximoCobro
  diasEnPeriodo:  number;   // días transcurridos en el bloque actual (1-30)
  proximaCarga:   string;   // = fechaProximoCobro
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Calcula el estado de almacenaje de un guardado.
 * @param fechaInicio  fecha de ingreso del guardado (ISO YYYY-MM-DD)
 * @param endDate      fecha de cierre (ISO). null = hoy. Para despachados: fechaDespacho.
 */
export function calcAlmacenaje(fechaInicio: string, endDate?: string | null): Almacenaje {
  const inicio = new Date(fechaInicio + "T00:00:00");
  const fin    = new Date((endDate ?? new Date().toISOString().slice(0, 10)) + "T00:00:00");

  // Normalizar a medianoche para evitar drift de hora
  inicio.setHours(0, 0, 0, 0);
  fin.setHours(0, 0, 0, 0);

  const diasTranscurridos = Math.max(0, Math.floor((fin.getTime() - inicio.getTime()) / 86_400_000));

  // ── Gracia: días 0-30 ────────────────────────────────────
  const diasGraciaRestantes = Math.max(0, 30 - diasTranscurridos);
  const fechaFinGracia      = addDays(inicio, 30);
  const fechaPrimerCobro    = addDays(inicio, 31);

  // ── Cobros: bloques de 30 días después del día 30 ────────
  // Cobros se generan al inicio de los días 31, 61, 91...
  const cobrosGenerados = diasTranscurridos <= 30
    ? 0
    : Math.floor((diasTranscurridos - 31) / 30) + 1;

  const costoAcumulado = cobrosGenerados * TARIFA_ALM;

  // Próximo cobro: día (31 + cobrosGenerados * 30) desde el ingreso
  const diaProximoCobro      = 31 + cobrosGenerados * 30;
  const diasHastaProximoCobro = diaProximoCobro - diasTranscurridos;
  const fechaProximoCobro     = addDays(fin, diasHastaProximoCobro);

  // Posición dentro del bloque actual (1-30)
  const diasEnPeriodo = diasTranscurridos <= 30
    ? diasTranscurridos
    : ((diasTranscurridos - 31) % 30) + 1;

  const fase: "gracia" | "cobro" = diasTranscurridos <= 30 ? "gracia" : "cobro";

  return {
    // Spec nueva
    diasTranscurridos,
    diasGraciaRestantes,
    cobrosGenerados,
    costoAcumulado,
    fechaPrimerCobro:      toISO(fechaPrimerCobro),
    fechaProximoCobro:     toISO(fechaProximoCobro),
    diasHastaProximoCobro,

    // Aliases compat
    fase,
    costo:          costoAcumulado,
    meses:          cobrosGenerados,
    finGracia:      toISO(fechaFinGracia),
    diasRestantes:  diasGraciaRestantes,
    costoProximo:   (cobrosGenerados + 1) * TARIFA_ALM,
    diasHastaProxima: diasHastaProximoCobro,
    diasEnPeriodo,
    proximaCarga:   toISO(fechaProximoCobro),
  };
}
