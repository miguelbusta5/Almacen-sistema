// ═══════════════════════════════════════════════════════════
// MÓDULO TIENDA — DESPACHOS
// Despachos creados en tienda → recogida → ruta → entrega al cliente
// ═══════════════════════════════════════════════════════════

export type EstadoDespacho =
  | "CREADO_TIENDA"
  | "RECOGIDA_PENDIENTE"
  | "RECOGIDO"
  | "EN_RUTA"
  | "ENTREGADO"
  | "CON_NOVEDAD";

export const ESTADOS_DESPACHO: EstadoDespacho[] = [
  "CREADO_TIENDA",
  "RECOGIDA_PENDIENTE",
  "RECOGIDO",
  "EN_RUTA",
  "ENTREGADO",
  "CON_NOVEDAD",
];

// Estados que transporte debe ver (pendientes de recogida)
export const ESTADOS_PENDIENTE_RECOGIDA: EstadoDespacho[] = [
  "CREADO_TIENDA",
  "RECOGIDA_PENDIENTE",
];

// Estados activos (no terminales)
export const ESTADOS_ACTIVOS: EstadoDespacho[] = [
  "CREADO_TIENDA",
  "RECOGIDA_PENDIENTE",
  "RECOGIDO",
  "EN_RUTA",
];

// Estados terminales
export const ESTADOS_TERMINAL: EstadoDespacho[] = ["ENTREGADO", "CON_NOVEDAD"];

export interface PlinDespacho {
  id: string;
  despachoId: string;
  plu: string;
  descripcion: string | null;
  unidades: number;
}

export interface DespachoTienda {
  id: string;
  centroCostos: string;
  numeroDocumento: string;
  consecutivo: string;
  clienteNombre: string;
  clienteDocumento: string | null;
  clienteTelefono: string | null;
  estado: EstadoDespacho;
  fechaCreacion: string;              // YYYY-MM-DD
  fechaEntregaComprometida: string | null;
  numeroCajas: number | null;
  recibidoAt: string | null;          // timestamp de RECOGIDO
  enRutaAt: string | null;            // timestamp de EN_RUTA
  despachadoAt: string | null;        // timestamp de ENTREGADO
  novedad: string | null;
  netsuiteId: string | null;
  creadoPorId: string;
  creadoPorNombre?: string;
  createdAt: string;
  updatedAt: string;
  plines?: PlinDespacho[];
}

// ── Labels y colores ──────────────────────────────────────
export const ESTADO_DESPACHO_LABEL: Record<EstadoDespacho, string> = {
  CREADO_TIENDA:      "Creado en tienda",
  RECOGIDA_PENDIENTE: "Recogida pendiente",
  RECOGIDO:           "Recogido por transporte",
  EN_RUTA:            "En ruta",
  ENTREGADO:          "Entregado al cliente",
  CON_NOVEDAD:        "Con novedad",
};

export const ESTADO_DESPACHO_COLOR: Record<EstadoDespacho, string> = {
  CREADO_TIENDA:      "#f59e0b",
  RECOGIDA_PENDIENTE: "#f97316",
  RECOGIDO:           "#3b82f6",
  EN_RUTA:            "#8b5cf6",
  ENTREGADO:          "#10b981",
  CON_NOVEDAD:        "#ef4444",
};

// Color del módulo tienda
export const COLOR_TIENDA = "#7c3aed";

// ── Badge variant ─────────────────────────────────────────
export function estadoDespachoVariant(
  e: EstadoDespacho
): "warning" | "info" | "success" | "error" | "default" {
  switch (e) {
    case "CREADO_TIENDA":      return "warning";
    case "RECOGIDA_PENDIENTE": return "warning";
    case "RECOGIDO":           return "info";
    case "EN_RUTA":            return "info";
    case "ENTREGADO":          return "success";
    case "CON_NOVEDAD":        return "error";
  }
}

// ── Formateo ──────────────────────────────────────────────
export function fmtFechaTienda(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Horas transcurridas desde la creación ─────────────────
export function horasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
}

// ── Secuencia de progreso para timeline visual ────────────
export const FLUJO_ESTADOS: EstadoDespacho[] = [
  "CREADO_TIENDA",
  "RECOGIDA_PENDIENTE",
  "RECOGIDO",
  "EN_RUTA",
  "ENTREGADO",
];

export function pasoEnFlujo(estado: EstadoDespacho): number {
  const idx = FLUJO_ESTADOS.indexOf(estado);
  if (idx >= 0) return idx;
  if (estado === "CON_NOVEDAD") return -1; // fuera del flujo normal
  return 0;
}
