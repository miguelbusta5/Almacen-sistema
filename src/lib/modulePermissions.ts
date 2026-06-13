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
  | "TRANSPORTISTA"       // Conductor — solo Preoperacional
  | "INVENTARIO"          // Operario inventario
  | "TRANSPORTE"          // Operario transporte/guardados
  | "SUPERVISOR_INVENTARIO"
  | "SUPERVISOR_TRANSPORTE"
  | "TIENDA"              // Operario de tienda
  | "SUPERVISOR_TIENDA"   // Supervisor de tienda
  | "OPERACIONES_MUEBLES" // Operario Operaciones Muebles
  | "OPERACIONES_GOURMET"; // Operario Operaciones Gourmet

// ── Claves de módulos ────────────────────────────────────
export type ModuleKey =
  | "inventario"
  | "transporte"
  | "preoperacional"
  | "conteo"
  | "conteo-contar"
  | "tienda"
  | "solicitudes-transporte"
  | "mis-tareas"
  | "usuarios"
  | "auditoria"
  | "centro-control"
  | "integracion";

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
  "preoperacional": ["TRANSPORTISTA", "ADMIN", "GERENTE", "SUPERVISOR_TRANSPORTE"],
  "conteo": [
    "INVENTARIO", "SUPERVISOR_INVENTARIO",
    "GERENTE", "ADMIN",
  ],
  "conteo-contar": [
    "INVENTARIO", "SUPERVISOR_INVENTARIO",
    "GERENTE", "ADMIN", "OPERADOR",
  ],
  "mis-tareas": [
    "ADMIN","GERENTE","OPERADOR",
    "INVENTARIO","TRANSPORTE","SUPERVISOR_INVENTARIO","SUPERVISOR_TRANSPORTE",
    "TIENDA","SUPERVISOR_TIENDA",
  ],
  "tienda": [
    "TIENDA", "SUPERVISOR_TIENDA",
    "SUPERVISOR_TRANSPORTE",
    "GERENTE", "ADMIN",
  ],
  "solicitudes-transporte": [
    "ADMIN", "GERENTE", "OPERADOR",
    "INVENTARIO", "TRANSPORTE", "SUPERVISOR_INVENTARIO", "SUPERVISOR_TRANSPORTE",
    "TIENDA", "SUPERVISOR_TIENDA",
    "OPERACIONES_MUEBLES", "OPERACIONES_GOURMET",
  ],
  "usuarios": ["ADMIN"],
  "auditoria": ["ADMIN", "GERENTE"],
  "centro-control": [
    "GERENTE", "ADMIN",
    "SUPERVISOR_INVENTARIO", "SUPERVISOR_TRANSPORTE", "SUPERVISOR_TIENDA",
  ],
  "integracion": [
    "OPERACIONES_MUEBLES", "OPERACIONES_GOURMET",
    "ADMIN", "GERENTE",
    "SUPERVISOR_TRANSPORTE", "TRANSPORTE",
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
  OPERACIONES_MUEBLES:    "Operaciones Muebles",
  OPERACIONES_GOURMET:    "Operaciones Gourmet",
};

// ── Descripción de cada rol para la UI de usuarios ──────
export const ROLE_DESCRIPTION: Record<AppRole, string> = {
  ADMIN:                  "Acceso total al sistema.",
  GERENTE:                "Ve todo. Sin acceso a configuración de sistema.",
  OPERADOR:               "Acceso general a inventario y transporte.",
  TRANSPORTISTA:          "Solo ve el módulo Preoperacional.",
  INVENTARIO:             "Solo ve módulos de inventario y conteo.",
  TRANSPORTE:             "Solo ve guardados y pendientes asignados.",
  SUPERVISOR_INVENTARIO:  "Inventario + análisis operacional.",
  SUPERVISOR_TRANSPORTE:  "Facturas Contado + guardados + centro de control.",
  TIENDA:                 "Solo ve y gestiona Facturas Contado.",
  SUPERVISOR_TIENDA:      "Tienda + análisis + Centro de Control.",
  OPERACIONES_MUEBLES:    "Solo ve y gestiona el módulo Integración de Pedidos (área Muebles).",
  OPERACIONES_GOURMET:    "Solo ve y gestiona el módulo Integración de Pedidos (área Gourmet).",
};
