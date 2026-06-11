// ═══════════════════════════════════════════════════════════
// MÁQUINA DE ESTADOS — FLUJO LOGÍSTICO TIENDA → CEDI → CLIENTE
// Fuente única de verdad para transiciones válidas y permisos por rol.
// ═══════════════════════════════════════════════════════════

export type EstadoDespacho =
  | "CREADO_TIENDA"
  | "RECHAZADO"
  | "RECOGIDO_TIENDA"
  | "ENTREGADO_CEDI"
  | "ENVIADO_CLIENTE"
  | "CON_NOVEDAD";

export const ESTADOS_ACTIVOS: EstadoDespacho[] = [
  "CREADO_TIENDA",
  "RECOGIDO_TIENDA",
  "ENTREGADO_CEDI",
];

// Transiciones válidas desde cada estado
export const TRANSICIONES_VALIDAS: Record<EstadoDespacho, EstadoDespacho[]> = {
  CREADO_TIENDA:      ["RECOGIDO_TIENDA", "CON_NOVEDAD", "RECHAZADO"],
  RECHAZADO:          ["CREADO_TIENDA"],
  RECOGIDO_TIENDA:    ["ENTREGADO_CEDI", "CON_NOVEDAD"],
  ENTREGADO_CEDI:     ["ENVIADO_CLIENTE", "CON_NOVEDAD"],
  ENVIADO_CLIENTE:    [],
  CON_NOVEDAD:        [],
};

// Roles que pueden ejecutar cada transición (key: "ORIGEN-DESTINO")
export const ROLES_POR_TRANSICION: Record<string, string[]> = {
  "CREADO_TIENDA-RECOGIDO_TIENDA":     ["SUPERVISOR_TRANSPORTE", "GERENTE", "ADMIN"],
  "CREADO_TIENDA-RECHAZADO":           ["SUPERVISOR_TRANSPORTE", "GERENTE", "ADMIN"],
  "RECHAZADO-CREADO_TIENDA":           ["TIENDA", "SUPERVISOR_TIENDA", "SUPERVISOR_TRANSPORTE", "GERENTE", "ADMIN"],
  "RECOGIDO_TIENDA-ENTREGADO_CEDI":    ["SUPERVISOR_TRANSPORTE", "GERENTE", "ADMIN"],
  "ENTREGADO_CEDI-ENVIADO_CLIENTE":    ["SUPERVISOR_TRANSPORTE", "GERENTE", "ADMIN"],
};

export function esTransicionValida(
  origen: EstadoDespacho,
  destino: EstadoDespacho
): boolean {
  return TRANSICIONES_VALIDAS[origen]?.includes(destino) ?? false;
}

export function rolPuedeTransicionar(
  role: string,
  origen: EstadoDespacho,
  destino: EstadoDespacho
): boolean {
  if (destino === "CON_NOVEDAD") {
    return ["SUPERVISOR_TRANSPORTE", "GERENTE", "ADMIN"].includes(role);
  }
  return ROLES_POR_TRANSICION[`${origen}-${destino}`]?.includes(role) ?? false;
}
