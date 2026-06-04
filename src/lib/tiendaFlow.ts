// ═══════════════════════════════════════════════════════════
// MÁQUINA DE ESTADOS — FLUJO LOGÍSTICO TIENDA → CEDI → CLIENTE
// Fuente única de verdad para transiciones válidas y permisos por rol.
// ═══════════════════════════════════════════════════════════

export type EstadoDespacho =
  | "CREADO_TIENDA"
  | "ASIGNADO_RECOGIDA"
  | "RECOGIDO_TIENDA"
  | "ENTREGADO_CEDI"
  | "EN_RUTA"
  | "ENTREGADO_CLIENTE"
  | "CON_NOVEDAD";

export const ESTADOS_ACTIVOS: EstadoDespacho[] = [
  "CREADO_TIENDA",
  "ASIGNADO_RECOGIDA",
  "RECOGIDO_TIENDA",
  "ENTREGADO_CEDI",
  "EN_RUTA",
];

// Transiciones válidas desde cada estado
export const TRANSICIONES_VALIDAS: Record<EstadoDespacho, EstadoDespacho[]> = {
  CREADO_TIENDA:      ["ASIGNADO_RECOGIDA", "CON_NOVEDAD"],
  ASIGNADO_RECOGIDA:  ["RECOGIDO_TIENDA", "CON_NOVEDAD"],
  RECOGIDO_TIENDA:    ["ENTREGADO_CEDI", "CON_NOVEDAD"],
  ENTREGADO_CEDI:     ["EN_RUTA", "CON_NOVEDAD"],
  EN_RUTA:            ["ENTREGADO_CLIENTE", "CON_NOVEDAD"],
  ENTREGADO_CLIENTE:  [],
  CON_NOVEDAD:        [],
};

// Roles que pueden ejecutar cada transición (key: "ORIGEN-DESTINO")
export const ROLES_POR_TRANSICION: Record<string, string[]> = {
  "CREADO_TIENDA-ASIGNADO_RECOGIDA":   ["SUPERVISOR_TRANSPORTE", "GERENTE", "ADMIN"],
  "ASIGNADO_RECOGIDA-RECOGIDO_TIENDA": ["TRANSPORTISTA", "TRANSPORTE", "TIENDA", "SUPERVISOR_TIENDA", "SUPERVISOR_TRANSPORTE", "GERENTE", "ADMIN"],
  "RECOGIDO_TIENDA-ENTREGADO_CEDI":    ["TRANSPORTISTA", "TRANSPORTE", "SUPERVISOR_TRANSPORTE", "GERENTE", "ADMIN"],
  "ENTREGADO_CEDI-EN_RUTA":            ["SUPERVISOR_TRANSPORTE", "GERENTE", "ADMIN"],
  "EN_RUTA-ENTREGADO_CLIENTE":         ["TRANSPORTISTA", "TRANSPORTE", "SUPERVISOR_TRANSPORTE", "GERENTE", "ADMIN"],
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
  if (destino === "CON_NOVEDAD") return true; // cualquier rol autenticado
  return ROLES_POR_TRANSICION[`${origen}-${destino}`]?.includes(role) ?? false;
}
