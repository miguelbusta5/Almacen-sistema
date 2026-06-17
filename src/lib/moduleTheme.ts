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

const BLUE       = "#1D4ED8";
const BLUE_TINT  = "rgba(29,78,216,0.10)";
const SLATE      = "#334155";
const SLATE_TINT = "rgba(51,65,85,0.10)";
const VIOLET     = "#7C3AED";
const VIOLET_TINT = "rgba(124,58,237,0.10)";
const TEAL       = "#0E7490";
const TEAL_TINT  = "rgba(14,116,144,0.10)";
const SKY        = "#0369A1";
const SKY_TINT   = "rgba(3,105,161,0.10)";
const GREEN      = "#16A34A";
const GREEN_TINT = "rgba(22,163,74,0.10)";

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
    color: VIOLET,
    tint: VIOLET_TINT,
  },
  transporte: {
    key: "transporte",
    label: "Guardados Transporte",
    shortLabel: "Transporte",
    description: "Custodia, guardados y pendientes operativos",
    color: TEAL,
    tint: TEAL_TINT,
  },
  preoperacional: {
    key: "preoperacional",
    label: "Preoperacional",
    shortLabel: "Preop",
    description: "Inspeccion diaria de vehiculos",
    color: GREEN,
    tint: GREEN_TINT,
  },
  conteo: {
    key: "conteo",
    label: "Conteo Ciclico",
    shortLabel: "Conteo",
    description: "Control activo de inventario",
    color: VIOLET,
    tint: VIOLET_TINT,
  },
  "conteo-contar": {
    key: "conteo-contar",
    label: "Contar",
    shortLabel: "Contar",
    description: "Captura operativa de conteo",
    color: VIOLET,
    tint: VIOLET_TINT,
  },
  tienda: {
    key: "tienda",
    label: "Facturas Contado",
    shortLabel: "Facturas",
    description: "Facturas contado desde tienda hacia el flujo CEDI",
    color: SKY,
    tint: SKY_TINT,
  },
  "solicitudes-transporte": {
    key: "solicitudes-transporte",
    label: "Solicitudes Transporte",
    shortLabel: "Solicitudes",
    description: "Solicitudes internas que gestiona el lider de transporte",
    color: TEAL,
    tint: TEAL_TINT,
  },
  exportaciones: {
    key: "exportaciones",
    label: "Exportaciones",
    shortLabel: "Export",
    description: "Etiquetado operativo de cajas de exportacion",
    color: "#DC2626",
    tint: "rgba(220,38,38,0.10)",
  },
  "mis-tareas": {
    key: "mis-tareas",
    label: "Mis Tareas",
    shortLabel: "Tareas",
    description: "Pendientes del dia por usuario",
    color: VIOLET,
    tint: VIOLET_TINT,
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
  indicadores: {
    key: "indicadores",
    label: "Indicadores CEDI",
    shortLabel: "Indicadores",
    description: "KPIs sincronizados desde Google Sheets",
    color: BLUE,
    tint: BLUE_TINT,
  },
  integracion: {
    key: "integracion",
    label: "Integracion Pedidos",
    shortLabel: "Integracion",
    description: "Picking OVDM/TSDM entre areas",
    color: SKY,
    tint: SKY_TINT,
  },
  studio: {
    key: "studio",
    label: "Studio",
    shortLabel: "Studio",
    description: "Dashboards conectados a Google Sheets",
    color: TEAL,
    tint: TEAL_TINT,
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
