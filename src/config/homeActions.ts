// ═══════════════════════════════════════════════════════════
// ACCIONES RÁPIDAS DEL HOME — filtradas por rol
//
// Fuente de verdad para qué acciones rápidas ve cada rol
// en el Dashboard > Inicio. Complementa modulePermissions.ts:
// si un rol no puede ver un módulo, no aparece su acción aquí.
// ═══════════════════════════════════════════════════════════

import type { AppRole, ModuleKey } from "@/lib/modulePermissions";
import { getModuleColor } from "@/lib/moduleTheme";

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
  // ── Transporte ──────────────────────────────────────────
  {
    id: "nueva-solicitud-transporte",
    title: "Nueva solicitud de transporte",
    description: "Solicitar entrega, recoleccion o traslado interno",
    href: "/dashboard/solicitudes-transporte",
    icon: "FileText",
    color: getModuleColor("solicitudes-transporte"),
    moduleKey: "solicitudes-transporte",
    roles: [
      "ADMIN", "GERENTE", "OPERADOR",
      "INVENTARIO", "TRANSPORTE", "SUPERVISOR_INVENTARIO", "SUPERVISOR_TRANSPORTE",
      "TIENDA", "SUPERVISOR_TIENDA",
    ],
    priority: 1,
  },
  {
    id: "registrar-exportacion",
    title: "Registrar exportación Ecuador",
    description: "Capturar caja, PLU y unidad de empaque",
    href: "/dashboard/exportaciones",
    icon: "Tags",
    color: getModuleColor("exportaciones"),
    moduleKey: "exportaciones",
    roles: ["ETIQUETADO", "SUPERVISOR_ALMACENAMIENTO", "GERENTE", "ADMIN"],
    priority: 1,
  },
  {
    id: "nuevo-guardado",
    title: "Nuevo guardado en transporte",
    description: "Registrar pedido en custodia de almacén",
    href: "/dashboard/transporte",
    icon: "Plus",
    color: getModuleColor("transporte"),
    moduleKey: "transporte",
    roles: ["TRANSPORTE", "SUPERVISOR_TRANSPORTE", "OPERADOR", "GERENTE", "ADMIN"],
    priority: 2,
  },
  // ── Tienda ──────────────────────────────────────────────
  {
    id: "nuevo-despacho-tienda",
    title: "Nueva Factura Contado",
    description: "Registrar factura contado para el flujo CEDI",
    href: "/dashboard/tienda",
    icon: "Store",
    color: getModuleColor("tienda"),
    moduleKey: "tienda",
    roles: [
      "TIENDA", "SUPERVISOR_TIENDA",
      "SUPERVISOR_TRANSPORTE",
      "GERENTE", "ADMIN",
    ],
    priority: 1,
  },
  // ── Integración de Pedidos ──────────────────────────────
  {
    id: "nueva-integracion",
    title: "Nueva integración de pedido",
    description: "Coordinar picking OVDM/TSDM entre áreas Muebles y Gourmet",
    href: "/dashboard/integracion",
    icon: "GitMerge",
    color: getModuleColor("integracion"),
    moduleKey: "integracion",
    roles: ["OPERACIONES_MUEBLES", "OPERACIONES_GOURMET", "ADMIN", "GERENTE"],
    priority: 1,
  },
  {
    id: "preoperacional",
    title: "Preoperacional",
    description: "Registrar inspección diaria del vehículo",
    href: "/dashboard/preoperacional",
    icon: "ShieldCheck",
    color: getModuleColor("preoperacional"),
    moduleKey: "preoperacional",
    roles: ["TRANSPORTISTA"],
    priority: 1,
  },
  // ── Supervisión ─────────────────────────────────────────
  {
    id: "centro-control",
    title: "Centro de control",
    description: "Inteligencia operacional y KPIs de área",
    href: "/dashboard/centro-control",
    icon: "BarChart2",
    color: getModuleColor("centro-control"),
    moduleKey: "centro-control",
    roles: [
      "ADMIN", "GERENTE",
      "SUPERVISOR_INVENTARIO", "SUPERVISOR_TRANSPORTE", "SUPERVISOR_TIENDA",
    ],
    priority: 1,
  },
  // ── Mapa de ciudades ────────────────────────────────────
  {
    id: "ver-mapa-ciudades",
    title: "Mapa de ciudades",
    description: "Ver distribución geográfica de solicitudes de transporte",
    href: "/dashboard/mapa-ciudades",
    icon: "Map",
    color: getModuleColor("mapa-ciudades"),
    moduleKey: "mapa-ciudades",
    roles: ["ADMIN", "GERENTE", "SUPERVISOR_TRANSPORTE", "SUPERVISOR_INVENTARIO", "SUPERVISOR_TIENDA"],
    priority: 3,
  },
  // ── Administración ──────────────────────────────────────
  {
    id: "gestionar-usuarios",
    title: "Gestionar usuarios",
    description: "Administrar cuentas y roles del sistema",
    href: "/dashboard/usuarios",
    icon: "Users",
    color: getModuleColor("usuarios"),
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
    color: getModuleColor("auditoria"),
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
