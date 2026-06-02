// ═══════════════════════════════════════════════════════════
// MÓDULO: NOVEDADES INVENTARIO
// Alias de muebles.ts — el módulo evolucionó de "Muebles"
// a cubrir cualquier SKU del CEDI.
// ═══════════════════════════════════════════════════════════

export * from "./muebles";

// Alias semántico para el nuevo nombre oficial
export type { Novedad as NovedadInventario } from "./muebles";
