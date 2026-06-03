// ═══════════════════════════════════════════════════════════
// ACCIONES RÁPIDAS DEL HOME — filtradas por rol
//
// Fuente de verdad para qué acciones rápidas ve cada rol
// en el Dashboard > Inicio. Complementa modulePermissions.ts:
// si un rol no puede ver un módulo, no aparece su acción aquí.
// ═══════════════════════════════════════════════════════════

import type { AppRole, ModuleKey } from "@/lib/modulePermissions";

export interface HomeAction {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: string;       // nombre de ícono Lucide (ver ICON_MAP en el componente)
  color: string;      // CSS color hex
  moduleKey: ModuleKey;
  roles: AppRole[];
  priority: number;   // orden ascendente dentro del mismo rol
}

// ── Catálogo completo de acciones ────────────────────────
export const HOME_ACTIONS: HomeAction[] = [
  // ── Inventario ──────────────────────────────────────────
  {
    id: "nueva-novedad",
    title: "Nueva novedad de inventario",
    description: "Registrar diferencia de PLU, posición o cantidad",
    href: "/dashboard/muebles",
    icon: "Plus",
    color: "#2563EB",
    moduleKey: "inventario",
    roles: ["INVENTARIO", "SUPERVISOR_INVENTARIO", "OPERADOR", "GERENTE", "ADMIN"],
    priority: 1,
  },
  {
    id: "ir-conteo",
    title: "Ir a conteo cíclico",
    description: "Continuar con los PLUs asignados para hoy",
    href: "/dashboard/conteo/contar",
    icon: "ClipboardList",
    color: "#16A34A",
    moduleKey: "conteo-contar",
    roles: ["INVENTARIO", "SUPERVISOR_INVENTARIO", "OPERADOR", "GERENTE", "ADMIN"],
    priority: 2,
  },
  // ── Transporte ──────────────────────────────────────────
  {
    id: "nuevo-guardado",
    title: "Nuevo guardado en transporte",
    description: "Registrar pedido en custodia de almacén",
    href: "/dashboard/transporte",
    icon: "Plus",
    color: "#0E7490",
    moduleKey: "transporte",
    roles: ["TRANSPORTE", "SUPERVISOR_TRANSPORTE", "OPERADOR", "GERENTE", "ADMIN"],
    priority: 1,
  },
  {
    id: "ver-ruta",
    title: "Ver ruta de logística",
    description: "Paradas, vehículos y estado de conductores",
    href: "/dashboard/logistica",
    icon: "Route",
    color: "#7C3AED",
    moduleKey: "logistica",
    roles: ["TRANSPORTE", "SUPERVISOR_TRANSPORTE", "OPERADOR", "GERENTE", "ADMIN"],
    priority: 3,
  },
  // ── Tienda ──────────────────────────────────────────────
  {
    id: "nuevo-despacho-tienda",
    title: "Nuevo despacho a tienda",
    description: "Registrar despacho de mercancía hacia tienda",
    href: "/dashboard/tienda",
    icon: "Store",
    color: "#D97706",
    moduleKey: "tienda",
    roles: [
      "TIENDA", "SUPERVISOR_TIENDA",
      "TRANSPORTE", "SUPERVISOR_TRANSPORTE",
      "OPERADOR", "GERENTE", "ADMIN",
    ],
    priority: 1,
  },
  // ── Mis tareas (todos los operarios) ────────────────────
  {
    id: "ver-mis-tareas",
    title: "Ver mis tareas",
    description: "Revisar pendientes y prioridades del día",
    href: "/dashboard/mis-tareas",
    icon: "CheckSquare",
    color: "#7C3AED",
    moduleKey: "mis-tareas",
    roles: [
      "INVENTARIO", "TRANSPORTE", "TIENDA", "TRANSPORTISTA",
      "SUPERVISOR_INVENTARIO", "SUPERVISOR_TRANSPORTE", "SUPERVISOR_TIENDA",
      "OPERADOR",
    ],
    priority: 2,
  },
  // ── Supervisión ─────────────────────────────────────────
  {
    id: "centro-control",
    title: "Centro de control",
    description: "Inteligencia operacional y KPIs de área",
    href: "/dashboard/centro-control",
    icon: "BarChart2",
    color: "#0F172A",
    moduleKey: "centro-control",
    roles: [
      "ADMIN", "GERENTE",
      "SUPERVISOR_INVENTARIO", "SUPERVISOR_TRANSPORTE", "SUPERVISOR_TIENDA",
    ],
    priority: 1,
  },
  // ── Administración ──────────────────────────────────────
  {
    id: "gestionar-usuarios",
    title: "Gestionar usuarios",
    description: "Administrar cuentas y roles del sistema",
    href: "/dashboard/usuarios",
    icon: "Users",
    color: "#475569",
    moduleKey: "usuarios",
    roles: ["ADMIN"],
    priority: 4,
  },
  {
    id: "ver-auditoria",
    title: "Ver auditoría",
    description: "Historial completo de acciones del sistema",
    href: "/dashboard/auditoria",
    icon: "History",
    color: "#475569",
    moduleKey: "auditoria",
    roles: ["ADMIN", "GERENTE"],
    priority: 5,
  },
];

// ── Helper principal ─────────────────────────────────────
export function getHomeActionsByRole(
  role: AppRole | string | null | undefined,
  max = 4
): HomeAction[] {
  if (!role) return [];
  return HOME_ACTIONS.filter((a) => a.roles.includes(role as AppRole))
    .sort((a, b) => a.priority - b.priority)
    .slice(0, max);
}
