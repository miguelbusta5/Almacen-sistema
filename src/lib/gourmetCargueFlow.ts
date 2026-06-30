// ═══════════════════════════════════════════════════════════
// MÁQUINA DE ESTADOS — CARGUE GOURMET
// Fuente única de verdad para transiciones válidas y permisos por rol.
// Mismo patrón que src/lib/tiendaFlow.ts.
// ═══════════════════════════════════════════════════════════

export type EstadoPedidoGourmet =
  | "BORRADOR"
  | "UBICACION_ASIGNADA"
  | "ENVIADO_A_TRANSPORTE"
  | "EN_CARGUE"
  | "CARGUE_COMPLETO"
  | "CARGUE_COMPLETO_MANUAL"
  | "CON_NOVEDAD"
  | "CANCELADO";

export const ESTADOS_PEDIDO_GOURMET: EstadoPedidoGourmet[] = [
  "BORRADOR",
  "UBICACION_ASIGNADA",
  "ENVIADO_A_TRANSPORTE",
  "EN_CARGUE",
  "CARGUE_COMPLETO",
  "CARGUE_COMPLETO_MANUAL",
  "CON_NOVEDAD",
  "CANCELADO",
];

export const ESTADOS_TERMINALES_GOURMET: EstadoPedidoGourmet[] = [
  "CARGUE_COMPLETO",
  "CARGUE_COMPLETO_MANUAL",
  "CANCELADO",
];

// Transiciones válidas desde cada estado
export const TRANSICIONES_GOURMET: Record<EstadoPedidoGourmet, EstadoPedidoGourmet[]> = {
  BORRADOR:               ["UBICACION_ASIGNADA", "CANCELADO"],
  // El cargue ahora arranca directo desde UBICACION_ASIGNADA (ya no se "envía a
  // Transporte"). ENVIADO_A_TRANSPORTE se mantiene solo para pedidos heredados
  // que ya estaban en ese estado: pueden seguir iniciando cargue.
  UBICACION_ASIGNADA:     ["EN_CARGUE", "UBICACION_ASIGNADA", "CANCELADO"],
  ENVIADO_A_TRANSPORTE:   ["EN_CARGUE", "CANCELADO"],
  EN_CARGUE:              ["CARGUE_COMPLETO", "CARGUE_COMPLETO_MANUAL", "CON_NOVEDAD"],
  CARGUE_COMPLETO:        [],
  CARGUE_COMPLETO_MANUAL: [],
  CON_NOVEDAD:            ["CARGUE_COMPLETO_MANUAL", "EN_CARGUE"],
  CANCELADO:              [],
};

// Roles que pueden ejecutar cada transición (key: "ORIGEN-DESTINO")
export const ROLES_POR_TRANSICION_GOURMET: Record<string, string[]> = {
  "BORRADOR-UBICACION_ASIGNADA":             ["OPERACIONES_GOURMET", "ADMIN", "GERENTE"],
  "BORRADOR-CANCELADO":                      ["ADMIN", "GERENTE"],
  "UBICACION_ASIGNADA-UBICACION_ASIGNADA":   ["OPERACIONES_GOURMET", "ADMIN", "GERENTE"],
  "UBICACION_ASIGNADA-CANCELADO":            ["ADMIN", "GERENTE"],
  // El ciclo de cargue (iniciar/finalizar/novedad/reanudar) lo operan ambas áreas:
  // Transporte y Gourmet (OPERACIONES_GOURMET). El cargue inicia directo desde
  // UBICACION_ASIGNADA; ENVIADO_A_TRANSPORTE queda solo para pedidos heredados.
  "UBICACION_ASIGNADA-EN_CARGUE":            ["TRANSPORTE", "SUPERVISOR_TRANSPORTE", "OPERACIONES_GOURMET", "ADMIN", "GERENTE"],
  "ENVIADO_A_TRANSPORTE-EN_CARGUE":          ["TRANSPORTE", "SUPERVISOR_TRANSPORTE", "OPERACIONES_GOURMET", "ADMIN", "GERENTE"],
  "ENVIADO_A_TRANSPORTE-CANCELADO":          ["ADMIN", "GERENTE"],
  "EN_CARGUE-CARGUE_COMPLETO":               ["TRANSPORTE", "SUPERVISOR_TRANSPORTE", "OPERACIONES_GOURMET", "ADMIN", "GERENTE"],
  "EN_CARGUE-CARGUE_COMPLETO_MANUAL":        ["SUPERVISOR_TRANSPORTE", "OPERACIONES_GOURMET", "ADMIN", "GERENTE"],
  "EN_CARGUE-CON_NOVEDAD":                   ["TRANSPORTE", "SUPERVISOR_TRANSPORTE", "OPERACIONES_GOURMET", "ADMIN", "GERENTE"],
  "CON_NOVEDAD-CARGUE_COMPLETO_MANUAL":      ["SUPERVISOR_TRANSPORTE", "OPERACIONES_GOURMET", "ADMIN", "GERENTE"],
  "CON_NOVEDAD-EN_CARGUE":                   ["TRANSPORTE", "SUPERVISOR_TRANSPORTE", "OPERACIONES_GOURMET", "ADMIN", "GERENTE"],
};

export function esEstadoTerminalGourmet(estado: EstadoPedidoGourmet): boolean {
  return ESTADOS_TERMINALES_GOURMET.includes(estado);
}

export function esTransicionValidaGourmet(
  origen: EstadoPedidoGourmet,
  destino: EstadoPedidoGourmet
): boolean {
  return TRANSICIONES_GOURMET[origen]?.includes(destino) ?? false;
}

export function rolPuedeTransicionarGourmet(
  role: string,
  origen: EstadoPedidoGourmet,
  destino: EstadoPedidoGourmet
): boolean {
  return ROLES_POR_TRANSICION_GOURMET[`${origen}-${destino}`]?.includes(role) ?? false;
}

export function puedeTransicionarGourmet(
  origen: EstadoPedidoGourmet,
  destino: EstadoPedidoGourmet,
  role: string
): boolean {
  return esTransicionValidaGourmet(origen, destino) && rolPuedeTransicionarGourmet(role, origen, destino);
}

export interface ResultadoAssertTransicionGourmet {
  ok: boolean;
  motivo?: "TRANSICION_INVALIDA" | "SIN_PERMISO";
  mensaje?: string;
}

/**
 * Valida una transición sin lanzar excepciones — devuelve un resultado
 * estructurado para que el caller (endpoint) decida el código HTTP.
 */
export function assertTransicionGourmet(
  origen: EstadoPedidoGourmet,
  destino: EstadoPedidoGourmet,
  role: string
): ResultadoAssertTransicionGourmet {
  if (!esTransicionValidaGourmet(origen, destino)) {
    return {
      ok: false,
      motivo: "TRANSICION_INVALIDA",
      mensaje: `Transición inválida: ${origen} → ${destino}`,
    };
  }
  if (!rolPuedeTransicionarGourmet(role, origen, destino)) {
    return {
      ok: false,
      motivo: "SIN_PERMISO",
      mensaje: "Sin permiso para esta transición de estado",
    };
  }
  return { ok: true };
}
