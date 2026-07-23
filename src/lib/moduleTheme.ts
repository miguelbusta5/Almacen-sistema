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
  heroGradient: string;
  glow: string;
  surface: string;
}

/* ─────────────────────────────────────────────────────────────────────────
   Acento ÚNICO (esmeralda). Todos los módulos comparten color/marca; se
   distinguen por icono, kicker y copy — no por color. Sin imágenes de hero.
   Los ESTADOS operativos sí tienen color propio, pero viven en los tokens
   --state-* de globals.css y en las variantes de Badge/DataTable, no aquí.
   ───────────────────────────────────────────────────────────────────────── */
const EMERALD = {
  color: "#14DBA0",
  tint: "rgba(20,219,160,0.13)",
  gradient: "linear-gradient(135deg,#0E9C76 0%,#14DBA0 58%,#5BF5C7 100%)",
  darkColor: "#14DBA0",
  darkTint: "rgba(20,219,160,0.13)",
  heroGradient: "linear-gradient(180deg,#161A1F 0%,#121519 100%)",
  glow: "rgba(20,219,160,0.34)",
  surface: "rgba(20,219,160,0.12)",
} as const;

function mod(
  key: ModuleThemeKey,
  label: string,
  shortLabel: string,
  description: string,
): ModuleTheme {
  return { key, label, shortLabel, description, ...EMERALD };
}

export const MODULE_THEME: Record<ModuleThemeKey, ModuleTheme> = {
  home: mod("home", PRODUCT.displayName, PRODUCT.shortName, PRODUCT.tagline),
  transporte: mod("transporte", "Guardados Transporte", "Transporte", "Custodia, guardados y pendientes operativos"),
  preoperacional: mod("preoperacional", "Preoperacional", "Preop", "Inspeccion diaria de vehiculos"),
  tienda: mod("tienda", "Facturas Contado", "Facturas", "Facturas contado desde tienda hacia el flujo CEDI"),
  "solicitudes-transporte": mod("solicitudes-transporte", "Solicitudes Transporte", "Solicitudes", "Solicitudes internas que gestiona el lider de transporte"),
  exportaciones: mod("exportaciones", "Exportaciones Ecuador", "Export EC", "Etiquetado operativo de cajas de exportacion a Ecuador"),
  "exportaciones-mexico": mod("exportaciones-mexico", "Exportaciones México", "Export MX", "Etiquetado operativo de cajas de exportacion a México"),
  "exportaciones-eeuu": mod("exportaciones-eeuu", "Exportaciones EE.UU", "Export US", "Etiquetado operativo de cajas de exportacion a EE.UU"),
  usuarios: mod("usuarios", "Usuarios", "Usuarios", "Cuentas, roles y operacion base"),
  auditoria: mod("auditoria", "Auditoria", "Auditoria", "Historial de acciones del sistema"),
  "centro-control": mod("centro-control", "Centro de Control", "Control", "Inteligencia operacional y KPIs"),
  integracion: mod("integracion", "Integracion Pedidos", "Integracion", "Picking OVDM/TSDM entre areas"),
  "cargue-gourmet": mod("cargue-gourmet", "Cargue Gourmet", "Cargue Gourmet", "Ubicacion y cargue verificado de pedidos Gourmet"),
  "mapa-ciudades": mod("mapa-ciudades", "Mapa de Ciudades", "Mapa", "Distribucion geografica de procesos logisticos"),
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
