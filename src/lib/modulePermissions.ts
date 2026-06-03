// ═══════════════════════════════════════════════════════════
// MATRIZ DE VISIBILIDAD DE MÓDULOS POR ROL
// Centro de Control Operacional — Grupo Ambiente CEDI
//
// Separa CRUD (permissions.ts) de VISIBILIDAD (este archivo).
// Un rol puede tener acceso CRUD pero no ver un módulo,
// o puede ver un módulo en modo solo lectura.
// ═══════════════════════════════════════════════════════════

export type AppRole =
  | "ADMIN"
  | "GERENTE"
  | "OPERADOR"            // Rol legado — acceso general
  | "TRANSPORTISTA"       // Conductor — solo Mi Ruta
  | "INVENTARIO"          // Operario inventario
  | "TRANSPORTE"          // Operario transporte/guardados
  | "SUPERVISOR_INVENTARIO"
  | "SUPERVISOR_TRANSPORTE"
  | "TIENDA"              // Operario de tienda
  | "SUPERVISOR_TIENDA";  // Supervisor de tienda

// ── Claves de módulos ────────────────────────────────────
export type ModuleKey =
  | "inventario"
  | "transporte"
  | "logistica"
  | "mi-ruta"
  | "conteo"
  | "conteo-contar"
  | "tienda"
  | "mis-tareas"
  | "usuarios"
  | "auditoria"
  | "centro-control";

// ── Matriz: qué roles pueden ver cada módulo ─────────────
export const MODULE_ACCESS: Record<ModuleKey, AppRole[]> = {
  "inventario": [
    "INVENTARIO", "SUPERVISOR_INVENTARIO",
    "GERENTE", "ADMIN", "OPERADOR",
  ],
  "transporte": [
    "TRANSPORTE", "SUPERVISOR_TRANSPORTE",
    "GERENTE", "ADMIN", "OPERADOR",
  ],
  "logistica": [
    "TRANSPORTE", "SUPERVISOR_TRANSPORTE",
    "GERENTE", "ADMIN",
  ],
  "mi-ruta": [
    "TRANSPORTISTA", "TRANSPORTE", "SUPERVISOR_TRANSPORTE",
    "GERENTE", "ADMIN", "OPERADOR",
  ],
  "conteo": [
    "INVENTARIO", "SUPERVISOR_INVENTARIO",
    "GERENTE", "ADMIN",
  ],
  "conteo-contar": [
    "INVENTARIO", "SUPERVISOR_INVENTARIO",
    "GERENTE", "ADMIN", "OPERADOR",
  ],
  "mis-tareas": [
    "ADMIN","GERENTE","OPERADOR","TRANSPORTISTA",
    "INVENTARIO","TRANSPORTE","SUPERVISOR_INVENTARIO","SUPERVISOR_TRANSPORTE",
    "TIENDA","SUPERVISOR_TIENDA",
  ],
  "tienda": [
    "TIENDA", "SUPERVISOR_TIENDA",
    "TRANSPORTE", "SUPERVISOR_TRANSPORTE", // Transporte ve despachos para gestionar recogidas
    "GERENTE", "ADMIN",
  ],
  "usuarios": ["ADMIN"],
  "auditoria": ["ADMIN", "GERENTE"],
  "centro-control": [
    "GERENTE", "ADMIN",
    "SUPERVISOR_INVENTARIO", "SUPERVISOR_TRANSPORTE", "SUPERVISOR_TIENDA",
  ],
};

// ── Helper: ¿puede este rol ver este módulo? ─────────────
export function canSeeModule(
  role: string | undefined | null,
  moduleKey: ModuleKey
): boolean {
  if (!role) return false;
  const allowed = MODULE_ACCESS[moduleKey];
  if (!allowed) return false;
  return allowed.includes(role as AppRole);
}

// ── Helper: qué módulos puede ver un rol ────────────────
export function getVisibleModules(role: string | undefined | null): ModuleKey[] {
  if (!role) return [];
  return (Object.keys(MODULE_ACCESS) as ModuleKey[]).filter(
    (key) => canSeeModule(role, key)
  );
}

// ── Labels de los nuevos roles ──────────────────────────
export const ROLE_LABEL_EXT: Record<AppRole, string> = {
  ADMIN:                  "Administrador",
  GERENTE:                "Gerente",
  OPERADOR:               "Operador (General)",
  TRANSPORTISTA:          "Transportista (Conductor)",
  INVENTARIO:             "Operario de Inventario",
  TRANSPORTE:             "Operario de Transporte",
  SUPERVISOR_INVENTARIO:  "Supervisor de Inventario",
  SUPERVISOR_TRANSPORTE:  "Supervisor de Transporte",
  TIENDA:                 "Operario de Tienda",
  SUPERVISOR_TIENDA:      "Supervisor de Tienda",
};

// ── Descripción de cada rol para la UI de usuarios ──────
export const ROLE_DESCRIPTION: Record<AppRole, string> = {
  ADMIN:                  "Acceso total al sistema.",
  GERENTE:                "Ve todo. Sin acceso a configuración de sistema.",
  OPERADOR:               "Acceso general a inventario y transporte.",
  TRANSPORTISTA:          "Solo ve 'Mi Ruta' y sus entregas.",
  INVENTARIO:             "Solo ve módulos de inventario y conteo.",
  TRANSPORTE:             "Solo ve guardados, logística y rutas.",
  SUPERVISOR_INVENTARIO:  "Inventario + análisis operacional.",
  SUPERVISOR_TRANSPORTE:  "Guardados + logística + KPIs conductores.",
  TIENDA:                 "Solo ve y gestiona despachos de tienda.",
  SUPERVISOR_TIENDA:      "Tienda + análisis + Centro de Control.",
};
