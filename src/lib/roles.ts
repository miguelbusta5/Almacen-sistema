import type { UserRole } from "@/types";

export const USER_ROLE_VALUES = [
  "ADMIN",
  "GERENTE",
  "OPERADOR",
  "TRANSPORTISTA",
  "INVENTARIO",
  "TRANSPORTE",
  "SUPERVISOR_INVENTARIO",
  "SUPERVISOR_TRANSPORTE",
  "TIENDA",
  "SUPERVISOR_TIENDA",
  "OPERACIONES_MUEBLES",
  "OPERACIONES_GOURMET",
  "ETIQUETADO",
  "SUPERVISOR_ALMACENAMIENTO",
] as const satisfies readonly UserRole[];

export const GESTORES_EXPORTACIONES = [
  "ADMIN",
  "GERENTE",
  "SUPERVISOR_ALMACENAMIENTO",
] as const satisfies readonly UserRole[];

export const USUARIOS_EXPORTACIONES = [
  "ETIQUETADO",
  ...GESTORES_EXPORTACIONES,
] as const satisfies readonly UserRole[];

export function isUserRole(value: string | null | undefined): value is UserRole {
  return Boolean(value && (USER_ROLE_VALUES as readonly string[]).includes(value));
}
