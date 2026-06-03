// ═══════════════════════════════════════════════════════════
// MÓDULO TIENDA — DESPACHOS
// Gestiona despachos creados en tiendas físicas que
// posteriormente recoge transporte para entrega al cliente.
// ═══════════════════════════════════════════════════════════

export type EstadoDespacho = "PENDIENTE" | "RECIBIDO" | "DESPACHADO" | "CON_NOVEDAD";

export const ESTADOS_DESPACHO: EstadoDespacho[] = [
  "PENDIENTE", "RECIBIDO", "DESPACHADO", "CON_NOVEDAD",
];

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
  fechaEntregaComprometida: string | null; // YYYY-MM-DD
  numeroCajas: number | null;
  recibidoAt: string | null;
  despachadoAt: string | null;
  novedad: string | null;
  creadoPorId: string;
  creadoPorNombre?: string;
  createdAt: string;
  updatedAt: string;
  plines?: PlinDespacho[];
}

// ── Labels y colores ──────────────────────────────────────
export const ESTADO_DESPACHO_LABEL: Record<EstadoDespacho, string> = {
  PENDIENTE:   "Pendiente",
  RECIBIDO:    "Recibido en transporte",
  DESPACHADO:  "Despachado al cliente",
  CON_NOVEDAD: "Con novedad",
};

export const ESTADO_DESPACHO_COLOR: Record<EstadoDespacho, string> = {
  PENDIENTE:   "#f59e0b",
  RECIBIDO:    "#3b82f6",
  DESPACHADO:  "#10b981",
  CON_NOVEDAD: "#ef4444",
};

// Color del módulo tienda
export const COLOR_TIENDA = "#7c3aed";

// ── Badge variant ─────────────────────────────────────────
export function estadoDespachoVariant(e: EstadoDespacho): "warning" | "info" | "success" | "error" {
  switch (e) {
    case "PENDIENTE":   return "warning";
    case "RECIBIDO":    return "info";
    case "DESPACHADO":  return "success";
    case "CON_NOVEDAD": return "error";
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
