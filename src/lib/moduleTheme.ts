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
  gradient: string;
  darkColor: string;
  darkTint: string;
  heroImage: string;
  heroGradient: string;
  glow: string;
  surface: string;
}

function theme(
  color: string,
  tint: string,
  gradient: string,
  darkColor: string,
  darkTint: string,
  heroImage: string,
  heroGradient: string,
  glow: string,
  surface: string,
) {
  return { color, tint, gradient, darkColor, darkTint, heroImage, heroGradient, glow, surface };
}

const HERO = "/ui/module-heroes/";

const BLUE = theme("#2563EB", "rgba(37,99,235,0.12)", "linear-gradient(135deg,#1D4ED8 0%,#2563EB 55%,#60A5FA 100%)", "#60A5FA", "rgba(96,165,250,0.16)", `${HERO}indicadores.webp`, "linear-gradient(135deg,#07172F 0%,#102B68 48%,#07111F 100%)", "rgba(37,99,235,0.52)", "rgba(37,99,235,0.16)");
const SLATE = theme("#64748B", "rgba(100,116,139,0.12)", "linear-gradient(135deg,#334155 0%,#64748B 100%)", "#CBD5E1", "rgba(203,213,225,0.14)", `${HERO}usuarios.webp`, "linear-gradient(135deg,#07111F 0%,#1E293B 52%,#0B1020 100%)", "rgba(148,163,184,0.36)", "rgba(100,116,139,0.16)");
const VIOLET = theme("#7C3AED", "rgba(124,58,237,0.13)", "linear-gradient(135deg,#5B21B6 0%,#7C3AED 52%,#A78BFA 100%)", "#A78BFA", "rgba(167,139,250,0.18)", `${HERO}facturas-contado.webp`, "linear-gradient(135deg,#120B2E 0%,#25105E 50%,#090F1D 100%)", "rgba(124,58,237,0.58)", "rgba(124,58,237,0.18)");
const TEAL = theme("#0891B2", "rgba(8,145,178,0.13)", "linear-gradient(135deg,#0E7490 0%,#0891B2 55%,#22D3EE 100%)", "#22D3EE", "rgba(34,211,238,0.17)", `${HERO}transporte.webp`, "linear-gradient(135deg,#051827 0%,#06465A 52%,#07111F 100%)", "rgba(8,145,178,0.52)", "rgba(8,145,178,0.16)");
const EMERALD = theme("#059669", "rgba(5,150,105,0.13)", "linear-gradient(135deg,#047857 0%,#059669 55%,#34D399 100%)", "#34D399", "rgba(52,211,153,0.16)", `${HERO}conteo.webp`, "linear-gradient(135deg,#041C18 0%,#064E3B 52%,#07111F 100%)", "rgba(5,150,105,0.48)", "rgba(5,150,105,0.16)");
const AMBER = theme("#D97706", "rgba(217,119,6,0.14)", "linear-gradient(135deg,#B45309 0%,#D97706 55%,#FBBF24 100%)", "#FBBF24", "rgba(251,191,36,0.17)", `${HERO}preoperacional.webp`, "linear-gradient(135deg,#211203 0%,#78350F 52%,#07111F 100%)", "rgba(217,119,6,0.50)", "rgba(217,119,6,0.17)");
const ROSE = theme("#E11D48", "rgba(225,29,72,0.13)", "linear-gradient(135deg,#BE123C 0%,#E11D48 56%,#FB7185 100%)", "#FB7185", "rgba(251,113,133,0.16)", `${HERO}exportaciones.webp`, "linear-gradient(135deg,#270714 0%,#701A35 52%,#07111F 100%)", "rgba(225,29,72,0.50)", "rgba(225,29,72,0.16)");
const INDIGO = theme("#4F46E5", "rgba(79,70,229,0.13)", "linear-gradient(135deg,#4338CA 0%,#4F46E5 55%,#818CF8 100%)", "#818CF8", "rgba(129,140,248,0.17)", `${HERO}inventario.webp`, "linear-gradient(135deg,#0A102F 0%,#312E81 52%,#07111F 100%)", "rgba(79,70,229,0.52)", "rgba(79,70,229,0.17)");

export const MODULE_THEME: Record<ModuleThemeKey, ModuleTheme> = {
  home: {
    key: "home",
    label: PRODUCT.displayName,
    shortLabel: PRODUCT.shortName,
    description: PRODUCT.tagline,
    ...BLUE,
  },
  inventario: {
    key: "inventario",
    label: "Novedades Inventario",
    shortLabel: "Inventario",
    description: "PLUs, posiciones y novedades del CEDI",
    ...INDIGO,
  },
  transporte: {
    key: "transporte",
    label: "Guardados Transporte",
    shortLabel: "Transporte",
    description: "Custodia, guardados y pendientes operativos",
    ...TEAL,
  },
  preoperacional: {
    key: "preoperacional",
    label: "Preoperacional",
    shortLabel: "Preop",
    description: "Inspeccion diaria de vehiculos",
    ...AMBER,
  },
  conteo: {
    key: "conteo",
    label: "Conteo Ciclico",
    shortLabel: "Conteo",
    description: "Control activo de inventario",
    ...EMERALD,
  },
  "conteo-contar": {
    key: "conteo-contar",
    label: "Contar",
    shortLabel: "Contar",
    description: "Captura operativa de conteo",
    ...EMERALD,
  },
  tienda: {
    key: "tienda",
    label: "Facturas Contado",
    shortLabel: "Facturas",
    description: "Facturas contado desde tienda hacia el flujo CEDI",
    ...VIOLET,
  },
  "solicitudes-transporte": {
    key: "solicitudes-transporte",
    label: "Solicitudes Transporte",
    shortLabel: "Solicitudes",
    description: "Solicitudes internas que gestiona el lider de transporte",
    ...TEAL,
    heroImage: `${HERO}solicitudes-transporte.webp`,
  },
  exportaciones: {
    key: "exportaciones",
    label: "Exportaciones",
    shortLabel: "Export",
    description: "Etiquetado operativo de cajas de exportacion",
    ...ROSE,
  },
  "mis-tareas": {
    key: "mis-tareas",
    label: "Mis Tareas",
    shortLabel: "Tareas",
    description: "Pendientes del dia por usuario",
    ...INDIGO,
  },
  usuarios: {
    key: "usuarios",
    label: "Usuarios",
    shortLabel: "Usuarios",
    description: "Cuentas, roles y operacion base",
    ...SLATE,
  },
  auditoria: {
    key: "auditoria",
    label: "Auditoria",
    shortLabel: "Auditoria",
    description: "Historial de acciones del sistema",
    ...SLATE,
  },
  "centro-control": {
    key: "centro-control",
    label: "Centro de Control",
    shortLabel: "Control",
    description: "Inteligencia operacional y KPIs",
    ...BLUE,
  },
  indicadores: {
    key: "indicadores",
    label: "Indicadores CEDI",
    shortLabel: "Indicadores",
    description: "KPIs sincronizados desde Google Sheets",
    ...BLUE,
  },
  integracion: {
    key: "integracion",
    label: "Integracion Pedidos",
    shortLabel: "Integracion",
    description: "Picking OVDM/TSDM entre areas",
    ...VIOLET,
    heroImage: `${HERO}integracion.webp`,
  },
  studio: {
    key: "studio",
    label: "Studio",
    shortLabel: "Studio",
    description: "Dashboards conectados a Google Sheets",
    ...TEAL,
  },
};

export function getModuleTheme(key: ModuleThemeKey | string | null | undefined): ModuleTheme {
  if (!key) return MODULE_THEME.home;
  return MODULE_THEME[key as ModuleThemeKey] ?? MODULE_THEME.home;
}

export function getModuleColor(key: ModuleThemeKey | string | null | undefined): string {
  return getModuleTheme(key).color;
}

export function getModuleCssVars(key: ModuleThemeKey | string | null | undefined) {
  const theme = getModuleTheme(key);
  return {
    "--mod-color": theme.color,
    "--module-color": theme.color,
    "--mod-tint": theme.tint,
    "--module-tint": theme.tint,
    "--mod-gradient": theme.gradient,
    "--module-gradient": theme.gradient,
    "--mod-dark-color": theme.darkColor,
    "--mod-dark-tint": theme.darkTint,
    "--module-hero-image": `url(${theme.heroImage})`,
    "--module-hero-gradient": theme.heroGradient,
    "--module-glow": theme.glow,
    "--module-surface": theme.surface,
  };
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
