// Matriz de permisos por rol. Módulo PURO (sin imports de servidor) para
// poder usarlo tanto en API routes como en componentes cliente.
import type { UserRole } from "@/types";

export type Action =
  | "create" | "edit" | "delete"
  | "manageUsers" | "viewAudit"
  | "manageLogistica" | "manageConteo";

// Roles que pueden crear registros
const CREADORES: UserRole[] = [
  "OPERADOR", "GERENTE", "ADMIN",
  "INVENTARIO", "SUPERVISOR_INVENTARIO",
  "TRANSPORTE", "SUPERVISOR_TRANSPORTE",
];

const MATRIX: Record<Action, UserRole[]> = {
  create:           CREADORES,
  edit:             ["GERENTE", "ADMIN", "SUPERVISOR_INVENTARIO", "SUPERVISOR_TRANSPORTE"],
  delete:           ["ADMIN"],
  manageUsers:      ["ADMIN"],
  viewAudit:        ["ADMIN"],          // visibilidad del módulo → modulePermissions.ts
  manageLogistica:  ["GERENTE", "ADMIN", "SUPERVISOR_TRANSPORTE"],
  manageConteo:     ["ADMIN", "SUPERVISOR_INVENTARIO"],
};

/** ¿El rol puede ejecutar la acción? */
export function can(role: UserRole | string | undefined | null, action: Action): boolean {
  if (!role) return false;
  return (MATRIX[action] as string[]).includes(role);
}

export const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN:                  "Administrador",
  GERENTE:                "Gerente",
  OPERADOR:               "Operador (General)",
  TRANSPORTISTA:          "Transportista",
  INVENTARIO:             "Operario Inventario",
  TRANSPORTE:             "Operario Transporte",
  SUPERVISOR_INVENTARIO:  "Supervisor Inventario",
  SUPERVISOR_TRANSPORTE:  "Supervisor Transporte",
};
