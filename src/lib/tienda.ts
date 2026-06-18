import { getModuleColor } from "@/lib/moduleTheme";

// ═══════════════════════════════════════════════════════════
// MÓDULO TIENDA — DESPACHOS
// Flujo: Tienda → CEDI (punto intermedio) → Cliente final
// ═══════════════════════════════════════════════════════════

export type EstadoDespacho =
  | "CREADO_TIENDA"
  | "RECHAZADO"
  | "RECOGIDO_TIENDA"
  | "ENTREGADO_CEDI"
  | "ENVIADO_CLIENTE"
  | "CON_NOVEDAD";

export const ESTADOS_DESPACHO: EstadoDespacho[] = [
  "CREADO_TIENDA",
  "RECHAZADO",
  "RECOGIDO_TIENDA",
  "ENTREGADO_CEDI",
  "ENVIADO_CLIENTE",
  "CON_NOVEDAD",
];

// Estados activos antes del envío al cliente.
export const ESTADOS_ACTIVOS: EstadoDespacho[] = [
  "CREADO_TIENDA",
  "RECOGIDO_TIENDA",
  "ENTREGADO_CEDI",
];

// Flujo lineal para el pipeline visual (excluye CON_NOVEDAD)
export const FLUJO_ESTADOS: EstadoDespacho[] = [
  "CREADO_TIENDA",
  "RECOGIDO_TIENDA",
  "ENTREGADO_CEDI",
  "ENVIADO_CLIENTE",
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
  recibidoAt: string | null;          // RECOGIDO_TIENDA
  entregadoCediAt: string | null;     // ENTREGADO_CEDI
  despachadoAt: string | null;        // ENVIADO_CLIENTE
  novedadAt: string | null;
  rechazadoAt: string | null;
  motivoRechazo: string | null;
  notaEntrega: string | null;
  guardadoPendiente: {
    id: string;
    estado: string;
    asignadoAId: string;
    asignadoANombre: string | null;
    guardadoClientId: string | null;
  } | null;

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
  observacionEntrega: string | null;
  fechaEntregaReal: string | null;

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
  RECHAZADO:          "Rechazado",
  RECOGIDO_TIENDA:    "Recogido en tienda",
  ENTREGADO_CEDI:     "Entregado en CEDI",
  ENVIADO_CLIENTE:    "Enviado al cliente",
  CON_NOVEDAD:        "Con novedad",
};

export const ESTADO_DESPACHO_COLOR: Record<EstadoDespacho, string> = {
  CREADO_TIENDA:      "#7C3AED",
  RECHAZADO:          "#DC2626",
  RECOGIDO_TIENDA:    "#0891B2",
  ENTREGADO_CEDI:     "#16A34A",
  ENVIADO_CLIENTE:    "#2563EB",
  CON_NOVEDAD:        "#D97706",
};

// Color del módulo tienda
export const COLOR_TIENDA = getModuleColor("tienda");

// ── Badge variant ─────────────────────────────────────────
export function estadoDespachoVariant(
  e: EstadoDespacho
): "warning" | "info" | "success" | "error" | "default" {
  switch (e) {
    case "CREADO_TIENDA":      return "warning";
    case "RECHAZADO":          return "error";
    case "RECOGIDO_TIENDA":    return "info";
    case "ENTREGADO_CEDI":     return "info";
    case "ENVIADO_CLIENTE":    return "success";
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
  if (estado === "CON_NOVEDAD" || estado === "RECHAZADO") return -1;
  return 0;
}
