import type { ModuleKey } from "@/lib/modulePermissions";
import { PRODUCT } from "@/config/product";

export type ModuleThemeKey = ModuleKey | "home";

export interface ModuleTheme {
  key: ModuleThemeKey;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  tint: string;
}

export const MODULE_THEME: Record<ModuleThemeKey, ModuleTheme> = {
  home: {
    key: "home",
    label: PRODUCT.displayName,
    shortLabel: PRODUCT.shortName,
    description: PRODUCT.tagline,
    color: "#2563EB",
    tint: "rgba(37,99,235,0.12)",
  },
  inventario: {
    key: "inventario",
    label: "Novedades Inventario",
    shortLabel: "Inventario",
    description: "PLUs, posiciones y novedades del CEDI",
    color: "#2563EB",
    tint: "rgba(37,99,235,0.12)",
  },
  transporte: {
    key: "transporte",
    label: "Guardados Transporte",
    shortLabel: "Transporte",
    description: "Custodia, guardados y pendientes operativos",
    color: "#0E7490",
    tint: "rgba(14,116,144,0.12)",
  },
  preoperacional: {
    key: "preoperacional",
    label: "Preoperacional",
    shortLabel: "Preop",
    description: "Inspección diaria de vehículos",
    color: "#0E7490",
    tint: "rgba(14,116,144,0.12)",
  },
  conteo: {
    key: "conteo",
    label: "Conteo Cíclico",
    shortLabel: "Conteo",
    description: "Control activo de inventario",
    color: "#16A34A",
    tint: "rgba(22,163,74,0.12)",
  },
  "conteo-contar": {
    key: "conteo-contar",
    label: "Contar",
    shortLabel: "Contar",
    description: "Captura operativa de conteo",
    color: "#16A34A",
    tint: "rgba(22,163,74,0.12)",
  },
  tienda: {
    key: "tienda",
    label: "Facturas Contado",
    shortLabel: "Facturas",
    description: "Facturas contado desde tienda hacia el flujo CEDI",
    color: "#D97706",
    tint: "rgba(217,119,6,0.14)",
  },
  "solicitudes-transporte": {
    key: "solicitudes-transporte",
    label: "Solicitudes Transporte",
    shortLabel: "Solicitudes",
    description: "Solicitudes internas que gestiona el lider de transporte",
    color: "#0E7490",
    tint: "rgba(14,116,144,0.12)",
  },
  "mis-tareas": {
    key: "mis-tareas",
    label: "Mis Tareas",
    shortLabel: "Tareas",
    description: "Pendientes del día por usuario",
    color: "#2563EB",
    tint: "rgba(37,99,235,0.12)",
  },
  usuarios: {
    key: "usuarios",
    label: "Usuarios",
    shortLabel: "Usuarios",
    description: "Cuentas, roles y operacion base",
    color: "#475569",
    tint: "rgba(71,85,105,0.14)",
  },
  auditoria: {
    key: "auditoria",
    label: "Auditoría",
    shortLabel: "Auditoría",
    description: "Historial de acciones del sistema",
    color: "#475569",
    tint: "rgba(71,85,105,0.14)",
  },
  "centro-control": {
    key: "centro-control",
    label: "Centro de Control",
    shortLabel: "Control",
    description: "Inteligencia operacional y KPIs",
    color: "#0F172A",
    tint: "rgba(15,23,42,0.12)",
  },
  integracion: {
    key: "integracion",
    label: "Integración Pedidos",
    shortLabel: "Integración",
    description: "Picking OVDM/TSDM entre áreas",
    color: "#7C3AED",
    tint: "rgba(124,58,237,0.12)",
  },
};

export function getModuleTheme(key: ModuleThemeKey | string | null | undefined): ModuleTheme {
  if (!key) return MODULE_THEME.home;
  return MODULE_THEME[key as ModuleThemeKey] ?? MODULE_THEME.home;
}

export function getModuleColor(key: ModuleThemeKey | string | null | undefined): string {
  return getModuleTheme(key).color;
}
