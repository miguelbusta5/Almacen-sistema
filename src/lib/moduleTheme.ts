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

const BLUE = "#1D4ED8";
const BLUE_TINT = "rgba(29,78,216,0.10)";
const SLATE = "#334155";
const SLATE_TINT = "rgba(51,65,85,0.10)";

export const MODULE_THEME: Record<ModuleThemeKey, ModuleTheme> = {
  home: {
    key: "home",
    label: PRODUCT.displayName,
    shortLabel: PRODUCT.shortName,
    description: PRODUCT.tagline,
    color: BLUE,
    tint: BLUE_TINT,
  },
  inventario: {
    key: "inventario",
    label: "Novedades Inventario",
    shortLabel: "Inventario",
    description: "PLUs, posiciones y novedades del CEDI",
    color: BLUE,
    tint: BLUE_TINT,
  },
  transporte: {
    key: "transporte",
    label: "Guardados Transporte",
    shortLabel: "Transporte",
    description: "Custodia, guardados y pendientes operativos",
    color: BLUE,
    tint: BLUE_TINT,
  },
  preoperacional: {
    key: "preoperacional",
    label: "Preoperacional",
    shortLabel: "Preop",
    description: "Inspeccion diaria de vehiculos",
    color: BLUE,
    tint: BLUE_TINT,
  },
  conteo: {
    key: "conteo",
    label: "Conteo Ciclico",
    shortLabel: "Conteo",
    description: "Control activo de inventario",
    color: BLUE,
    tint: BLUE_TINT,
  },
  "conteo-contar": {
    key: "conteo-contar",
    label: "Contar",
    shortLabel: "Contar",
    description: "Captura operativa de conteo",
    color: BLUE,
    tint: BLUE_TINT,
  },
  tienda: {
    key: "tienda",
    label: "Facturas Contado",
    shortLabel: "Facturas",
    description: "Facturas contado desde tienda hacia el flujo CEDI",
    color: BLUE,
    tint: BLUE_TINT,
  },
  "solicitudes-transporte": {
    key: "solicitudes-transporte",
    label: "Solicitudes Transporte",
    shortLabel: "Solicitudes",
    description: "Solicitudes internas que gestiona el lider de transporte",
    color: BLUE,
    tint: BLUE_TINT,
  },
  exportaciones: {
    key: "exportaciones",
    label: "Exportaciones",
    shortLabel: "Export",
    description: "Etiquetado operativo de cajas de exportacion",
    color: BLUE,
    tint: BLUE_TINT,
  },
  "mis-tareas": {
    key: "mis-tareas",
    label: "Mis Tareas",
    shortLabel: "Tareas",
    description: "Pendientes del dia por usuario",
    color: BLUE,
    tint: BLUE_TINT,
  },
  usuarios: {
    key: "usuarios",
    label: "Usuarios",
    shortLabel: "Usuarios",
    description: "Cuentas, roles y operacion base",
    color: SLATE,
    tint: SLATE_TINT,
  },
  auditoria: {
    key: "auditoria",
    label: "Auditoria",
    shortLabel: "Auditoria",
    description: "Historial de acciones del sistema",
    color: SLATE,
    tint: SLATE_TINT,
  },
  "centro-control": {
    key: "centro-control",
    label: "Centro de Control",
    shortLabel: "Control",
    description: "Inteligencia operacional y KPIs",
    color: SLATE,
    tint: SLATE_TINT,
  },
  integracion: {
    key: "integracion",
    label: "Integracion Pedidos",
    shortLabel: "Integracion",
    description: "Picking OVDM/TSDM entre areas",
    color: BLUE,
    tint: BLUE_TINT,
  },
};

export function getModuleTheme(key: ModuleThemeKey | string | null | undefined): ModuleTheme {
  if (!key) return MODULE_THEME.home;
  return MODULE_THEME[key as ModuleThemeKey] ?? MODULE_THEME.home;
}

export function getModuleColor(key: ModuleThemeKey | string | null | undefined): string {
  return getModuleTheme(key).color;
}

export function getModuleIconBg(hexColor: string, opacity = 0.12): string {
  const h = hexColor.replace("#", "");
  if (h.length === 6) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${opacity})`;
  }
  return hexColor + "1F";
}
