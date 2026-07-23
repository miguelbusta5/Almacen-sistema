// ════════════════════════════════════════════════
// LÓGICA DE ALMACENAJE — Regla de 30 días de gracia + cobro diario
//
// Período de gracia: días 0-30 (inclusive) → $0
// A partir del día 31, se cobra $5.000 por cada día transcurrido
// (acumulación diaria, sin bloques de 30 días).
//
// Ejemplos:
//   Día  30 → $0 (último día de gracia)
//   Día  31 → $5.000  (1 día cobrado)
//   Día  60 → $150.000 (30 días cobrados)
//   Día  90 → $300.000 (60 días cobrados)
// ════════════════════════════════════════════════

export const TARIFA_ALM = 5_000; // $5.000 COP por día después de la gracia

export interface Almacenaje {
  // ── Campos nuevos (spec correcta) ────────────────────────
  diasTranscurridos:     number;
  diasGraciaRestantes:   number;   // 0 si ya venció la gracia
  cobrosGenerados:       number;   // días cobrados (1 cobro = 1 día)
  costoAcumulado:        number;
  fechaPrimerCobro:      string;   // YYYY-MM-DD (día 31 desde ingreso)
  fechaProximoCobro:     string;   // YYYY-MM-DD (próximo día que se cobra)
  diasHastaProximoCobro: number;

  // ── Aliases de compatibilidad (código existente) ─────────
  fase:           "gracia" | "cobro";
  costo:          number;   // = costoAcumulado
  meses:          number;   // = cobrosGenerados (días cobrados)
  finGracia:      string;   // fecha en que termina el período de gracia (día 30)
  diasRestantes:  number;   // = diasGraciaRestantes
  costoProximo:   number;   // costo tras sumar el próximo día cobrado
  diasHastaProxima: number; // = diasHastaProximoCobro
  diasEnPeriodo:  number;   // ya no hay bloques de 30: 1 si está en cobro, días si en gracia
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

  // ── Cobro diario a partir del día 31 ─────────────────────
  const diasCobrados   = Math.max(0, diasTranscurridos - 30);
  const costoAcumulado = diasCobrados * TARIFA_ALM;

  // Próximo día que se cobra: día 31 si aún en gracia, mañana si ya en cobro
  const diasHastaProximoCobro = diasTranscurridos <= 30 ? 31 - diasTranscurridos : 1;
  const fechaProximoCobro     = addDays(fin, diasHastaProximoCobro);

  const fase: "gracia" | "cobro" = diasTranscurridos <= 30 ? "gracia" : "cobro";

  // Ya no hay bloques de 30 días: cada día cobrado es su propio período.
  const diasEnPeriodo = diasCobrados > 0 ? 1 : diasTranscurridos;

  return {
    // Spec nueva
    diasTranscurridos,
    diasGraciaRestantes,
    cobrosGenerados: diasCobrados,
    costoAcumulado,
    fechaPrimerCobro:      toISO(fechaPrimerCobro),
    fechaProximoCobro:     toISO(fechaProximoCobro),
    diasHastaProximoCobro,

    // Aliases compat
    fase,
    costo:          costoAcumulado,
    meses:          diasCobrados,
    finGracia:      toISO(fechaFinGracia),
    diasRestantes:  diasGraciaRestantes,
    costoProximo:   costoAcumulado + TARIFA_ALM,
    diasHastaProxima: diasHastaProximoCobro,
    diasEnPeriodo,
    proximaCarga:   toISO(fechaProximoCobro),
  };
}
