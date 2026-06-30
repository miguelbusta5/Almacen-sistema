// Matriz de visibilidad de modulos por rol.
// CRUD vive en permissions.ts; este archivo controla UI/navegacion.

import type { UserRole } from "@/types";

export type AppRole = UserRole;

export type ModuleKey =
  | "inventario"
  | "transporte"
  | "preoperacional"
  | "tienda"
  | "solicitudes-transporte"
  | "exportaciones"
  | "exportaciones-mexico"
  | "exportaciones-eeuu"
  | "mis-tareas"
  | "usuarios"
  | "auditoria"
  | "centro-control"
  | "integracion"
  | "cargue-gourmet"
  | "mapa-ciudades";

export const MODULE_ACCESS: Record<ModuleKey, AppRole[]> = {
  inventario: ["INVENTARIO", "SUPERVISOR_INVENTARIO", "GERENTE", "ADMIN", "OPERADOR"],
  transporte: ["TRANSPORTE", "SUPERVISOR_TRANSPORTE", "GERENTE", "ADMIN", "OPERADOR"],
  preoperacional: ["TRANSPORTISTA", "ADMIN", "GERENTE", "SUPERVISOR_TRANSPORTE"],
  "mis-tareas": [
    "ADMIN",
    "GERENTE",
    "OPERADOR",
    "INVENTARIO",
    "TRANSPORTE",
    "SUPERVISOR_INVENTARIO",
    "SUPERVISOR_TRANSPORTE",
    "TIENDA",
    "SUPERVISOR_TIENDA",
  ],
  tienda: ["TIENDA", "SUPERVISOR_TIENDA", "SUPERVISOR_TRANSPORTE", "GERENTE", "ADMIN"],
  "solicitudes-transporte": [
    "ADMIN",
    "GERENTE",
    "OPERADOR",
    "INVENTARIO",
    "TRANSPORTE",
    "SUPERVISOR_INVENTARIO",
    "SUPERVISOR_TRANSPORTE",
    "TIENDA",
    "SUPERVISOR_TIENDA",
    "OPERACIONES_MUEBLES",
    "OPERACIONES_GOURMET",
  ],
  exportaciones: ["ETIQUETADO", "SUPERVISOR_ALMACENAMIENTO", "GERENTE", "ADMIN"],
  "exportaciones-mexico": ["ETIQUETADO", "SUPERVISOR_ALMACENAMIENTO", "GERENTE", "ADMIN"],
  "exportaciones-eeuu": ["ETIQUETADO", "SUPERVISOR_ALMACENAMIENTO", "GERENTE", "ADMIN"],
  usuarios: ["ADMIN"],
  auditoria: ["ADMIN", "GERENTE"],
  "centro-control": [
    "GERENTE",
    "ADMIN",
    "SUPERVISOR_INVENTARIO",
    "SUPERVISOR_TRANSPORTE",
    "SUPERVISOR_TIENDA",
    "SUPERVISOR_ALMACENAMIENTO",
  ],
  integracion: [
    "OPERACIONES_MUEBLES",
    "OPERACIONES_GOURMET",
    "ADMIN",
    "GERENTE",
    "SUPERVISOR_TRANSPORTE",
    "TRANSPORTE",
  ],
  "cargue-gourmet": [
    "ADMIN",
    "GERENTE",
    "OPERACIONES_GOURMET",
    "TRANSPORTE",
    "SUPERVISOR_TRANSPORTE",
  ],
  "mapa-ciudades": [
    "ADMIN",
    "GERENTE",
    "SUPERVISOR_TRANSPORTE",
    "SUPERVISOR_INVENTARIO",
    "SUPERVISOR_TIENDA",
  ],
};

export function canSeeModule(role: string | undefined | null, moduleKey: ModuleKey): boolean {
  if (!role) return false;
  return (MODULE_ACCESS[moduleKey] as string[] | undefined)?.includes(role) ?? false;
}

export function getVisibleModules(role: string | undefined | null): ModuleKey[] {
  if (!role) return [];
  return (Object.keys(MODULE_ACCESS) as ModuleKey[]).filter((key) => canSeeModule(role, key));
}

export const ROLE_LABEL_EXT: Record<AppRole, string> = {
  ADMIN: "Administrador",
  GERENTE: "Gerente",
  OPERADOR: "Operador (General)",
  TRANSPORTISTA: "Transportista (Conductor)",
  INVENTARIO: "Operario de Inventario",
  TRANSPORTE: "Operario de Transporte",
  SUPERVISOR_INVENTARIO: "Supervisor de Inventario",
  SUPERVISOR_TRANSPORTE: "Supervisor de Transporte",
  TIENDA: "Operario de Tienda",
  SUPERVISOR_TIENDA: "Supervisor de Tienda",
  OPERACIONES_MUEBLES: "Operaciones Muebles",
  OPERACIONES_GOURMET: "Operaciones Gourmet",
  ETIQUETADO: "Etiquetado",
  SUPERVISOR_ALMACENAMIENTO: "Supervisor de Almacenamiento",
};

export const ROLE_DESCRIPTION: Record<AppRole, string> = {
  ADMIN: "Acceso total al sistema.",
  GERENTE: "Ve todo. Sin acceso a configuracion de sistema.",
  OPERADOR: "Acceso general a inventario y transporte.",
  TRANSPORTISTA: "Solo ve el modulo Preoperacional.",
  INVENTARIO: "Solo ve el modulo de inventario.",
  TRANSPORTE: "Solo ve guardados y pendientes asignados.",
  SUPERVISOR_INVENTARIO: "Inventario + analisis operacional.",
  SUPERVISOR_TRANSPORTE: "Facturas Contado + guardados + centro de control.",
  TIENDA: "Solo ve y gestiona Facturas Contado.",
  SUPERVISOR_TIENDA: "Tienda + analisis + Centro de Control.",
  OPERACIONES_MUEBLES: "Solo ve y gestiona el modulo Integracion de Pedidos.",
  OPERACIONES_GOURMET: "Solo ve y gestiona el modulo Integracion de Pedidos.",
  ETIQUETADO: "Solo ve y captura etiquetas de Exportaciones.",
  SUPERVISOR_ALMACENAMIENTO: "Gestiona Exportaciones y seguimiento de etiquetado.",
};
