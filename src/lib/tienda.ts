// ═══════════════════════════════════════════════════════════
// MÓDULO TIENDA — DESPACHOS
// Flujo: Tienda → CEDI (punto intermedio) → Cliente final
// ═══════════════════════════════════════════════════════════

export type EstadoDespacho =
  | "CREADO_TIENDA"
  | "ASIGNADO_RECOGIDA"
  | "RECOGIDO_TIENDA"
  | "ENTREGADO_CEDI"
  | "EN_RUTA"
  | "ENTREGADO_CLIENTE"
  | "CON_NOVEDAD";

export const ESTADOS_DESPACHO: EstadoDespacho[] = [
  "CREADO_TIENDA",
  "ASIGNADO_RECOGIDA",
  "RECOGIDO_TIENDA",
  "ENTREGADO_CEDI",
  "EN_RUTA",
  "ENTREGADO_CLIENTE",
  "CON_NOVEDAD",
];

// Estados que aún no han sido entregados al cliente (activos)
export const ESTADOS_ACTIVOS: EstadoDespacho[] = [
  "CREADO_TIENDA",
  "ASIGNADO_RECOGIDA",
  "RECOGIDO_TIENDA",
  "ENTREGADO_CEDI",
  "EN_RUTA",
];

// Flujo lineal para el pipeline visual (excluye CON_NOVEDAD)
export const FLUJO_ESTADOS: EstadoDespacho[] = [
  "CREADO_TIENDA",
  "ASIGNADO_RECOGIDA",
  "RECOGIDO_TIENDA",
  "ENTREGADO_CEDI",
  "EN_RUTA",
  "ENTREGADO_CLIENTE",
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
  fechaEntregaComprometida: string | null;
  numeroCajas: number | null;
  netsuiteId: string | null;

  // Timestamps por estado
  asignadoRecogidaAt: string | null;
  recibidoAt: string | null;          // RECOGIDO_TIENDA
  entregadoCediAt: string | null;     // ENTREGADO_CEDI
  enRutaAt: string | null;
  despachadoAt: string | null;        // ENTREGADO_CLIENTE
  novedadAt: string | null;

  // Asignación
  conductorAsignadoId: string | null;
  conductorAsignadoNombre: string | null;
  vehiculoAsignadoId: string | null;
  vehiculoAsignadoPlaca: string | null;
  asignadoPorId: string | null;

  // Ruta
  rutaId: string | null;

  // Dirección de entrega
  direccionEntrega: string | null;
  barrio: string | null;
  ciudad: string | null;
  departamento: string | null;
  latitud: number | null;
  longitud: number | null;

  // Contacto de entrega
  contactoEntrega: string | null;
  telefonoEntrega: string | null;

  // Evidencias por etapa
  fotoRecogidaUrl: string | null;
  fotoCediUrl: string | null;
  recibidoPorCedi: string | null;

  // Evidencia de entrega al cliente
  firmaUrl: string | null;
  evidenciaUrl: string | null;
  observacionEntrega: string | null;
  fechaEntregaReal: string | null;
  fechaGpsEntrega: string | null;
  latitudEntrega: number | null;
  longitudEntrega: number | null;

  novedad: string | null;
  creadoPorId: string;
  creadoPorNombre?: string;
  createdAt: string;
  updatedAt: string;
  plines?: PlinDespacho[];
}

// ── Labels y colores ──────────────────────────────────────
export const ESTADO_DESPACHO_LABEL: Record<EstadoDespacho, string> = {
  CREADO_TIENDA:      "Creado en tienda",
  ASIGNADO_RECOGIDA:  "Asignado para recogida",
  RECOGIDO_TIENDA:    "Recogido en tienda",
  ENTREGADO_CEDI:     "Entregado en CEDI",
  EN_RUTA:            "En ruta",
  ENTREGADO_CLIENTE:  "Entregado al cliente",
  CON_NOVEDAD:        "Con novedad",
};

export const ESTADO_DESPACHO_COLOR: Record<EstadoDespacho, string> = {
  CREADO_TIENDA:      "#f59e0b",
  ASIGNADO_RECOGIDA:  "#f97316",
  RECOGIDO_TIENDA:    "#3b82f6",
  ENTREGADO_CEDI:     "#8b5cf6",
  EN_RUTA:            "#06b6d4",
  ENTREGADO_CLIENTE:  "#10b981",
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
    case "ASIGNADO_RECOGIDA":  return "warning";
    case "RECOGIDO_TIENDA":    return "info";
    case "ENTREGADO_CEDI":     return "info";
    case "EN_RUTA":            return "info";
    case "ENTREGADO_CLIENTE":  return "success";
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

export function horasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
}

// ── Paso en el flujo lineal ───────────────────────────────
export function pasoEnFlujo(estado: EstadoDespacho): number {
  const idx = FLUJO_ESTADOS.indexOf(estado);
  if (idx >= 0) return idx;
  if (estado === "CON_NOVEDAD") return -1;
  return 0;
}
