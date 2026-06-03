// ═══════════════════════════════════════════════════════════
// LÓGICA DE SLA (Service Level Agreement) — Novedades
// ═══════════════════════════════════════════════════════════

export type SlaEstado = "EN_SLA" | "PROXIMO" | "VENCIDO" | "SIN_FECHA";

export const SLA_COLOR: Record<SlaEstado, string> = {
  EN_SLA:   "var(--success)",
  PROXIMO:  "var(--warning)",
  VENCIDO:  "var(--error)",
  SIN_FECHA:"var(--muted)",
};

export const SLA_LABEL: Record<SlaEstado, string> = {
  EN_SLA:   "En SLA",
  PROXIMO:  "Próximo a vencer",
  VENCIDO:  "SLA vencido",
  SIN_FECHA:"Sin fecha compromiso",
};

export function calcSla(fechaCompromiso: string | null): SlaEstado {
  if (!fechaCompromiso) return "SIN_FECHA";
  const hoy  = new Date(); hoy.setHours(0, 0, 0, 0);
  const comp = new Date(fechaCompromiso + "T00:00:00");
  const diff = Math.floor((comp.getTime() - hoy.getTime()) / 86_400_000);
  if (diff < 0)  return "VENCIDO";
  if (diff <= 2) return "PROXIMO";
  return "EN_SLA";
}

export function diasRestantesSla(fechaCompromiso: string | null): number | null {
  if (!fechaCompromiso) return null;
  const hoy  = new Date(); hoy.setHours(0, 0, 0, 0);
  const comp = new Date(fechaCompromiso + "T00:00:00");
  return Math.floor((comp.getTime() - hoy.getTime()) / 86_400_000);
}
