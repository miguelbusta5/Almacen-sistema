// Matriz de permisos por rol. Módulo PURO (sin imports de servidor) para
// poder usarlo tanto en API routes como en componentes cliente.
import type { UserRole } from "@/types";

export type Action = "create" | "edit" | "delete" | "manageUsers" | "viewAudit" | "manageLogistica" | "manageConteo";

const MATRIX: Record<Action, UserRole[]> = {
  create: ["OPERADOR", "GERENTE", "ADMIN"],
  edit: ["GERENTE", "ADMIN"],
  delete: ["ADMIN"],
  manageUsers: ["ADMIN"],
  viewAudit: ["ADMIN"],
  manageLogistica: ["GERENTE", "ADMIN"],
  manageConteo: ["ADMIN"],
};

/** ¿El rol puede ejecutar la acción? */
export function can(role: UserRole | string | undefined | null, action: Action): boolean {
  if (!role) return false;
  return MATRIX[action].includes(role as UserRole);
}

export const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: "Administrador",
  GERENTE: "Gerente",
  OPERADOR: "Operador",
};
