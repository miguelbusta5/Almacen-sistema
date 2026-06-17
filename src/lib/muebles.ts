// ════════════════════════════════════════════════
// TIPOS Y UTILIDADES DEL MÓDULO NOVEDADES MUEBLES
// Novedad = diferencia de inventario (PLU en una posición
// con una cantidad +/- y un estado de resolución).
// ════════════════════════════════════════════════

export type EstadoNovedad = "PENDIENTE" | "EN PROCESO" | "SOLUCIONADO";
export const ESTADOS: EstadoNovedad[] = ["PENDIENTE", "EN PROCESO", "SOLUCIONADO"];

// ── Tipo de novedad ───────────────────────────────────────
export type TipoNovedad =
  | "SOBRANTE" | "FALTANTE" | "DAÑADO" | "MAL_UBICADO"
  | "ERROR_SISTEMA" | "ERROR_PROVEEDOR" | "ERROR_DESPACHO";

export const TIPOS_NOVEDAD: TipoNovedad[] = [
  "SOBRANTE", "FALTANTE", "DAÑADO", "MAL_UBICADO",
  "ERROR_SISTEMA", "ERROR_PROVEEDOR", "ERROR_DESPACHO",
];

export const TIPO_NOVEDAD_LABEL: Record<TipoNovedad, string> = {
  SOBRANTE:         "Sobrante (existe, no en sistema)",
  FALTANTE:         "Faltante (en sistema, no existe)",
  DAÑADO:           "Producto dañado",
  MAL_UBICADO:      "Mal ubicado",
  ERROR_SISTEMA:    "Error de sistema / NetSuite",
  ERROR_PROVEEDOR:  "Error de proveedor",
  ERROR_DESPACHO:   "Error de despacho",
};

export const TIPO_NOVEDAD_COLOR: Record<TipoNovedad, string> = {
  SOBRANTE:        "#1D4ED8",
  FALTANTE:        "#B42318",
  DAÑADO:          "#475569",
  MAL_UBICADO:     "#475569",
  ERROR_SISTEMA:   "#1D4ED8",
  ERROR_PROVEEDOR: "#6366f1",
  ERROR_DESPACHO:  "#B42318",
};

// ── Causa raíz ───────────────────────────────────────────
export type CausaRaiz =
  | "HUMANO" | "SISTEMA" | "PROVEEDOR" | "DANIO" | "HURTO"
  | "UBICACION" | "DESPACHO";

export const CAUSAS_RAIZ: CausaRaiz[] = [
  "HUMANO", "SISTEMA", "PROVEEDOR", "DANIO", "HURTO", "UBICACION", "DESPACHO",
];

export const CAUSA_RAIZ_LABEL: Record<CausaRaiz, string> = {
  HUMANO:    "Error humano (conteo, digitación, picking)",
  SISTEMA:   "Error de sistema (NetSuite desactualizado)",
  PROVEEDOR: "Error de proveedor (recepción incorrecta)",
  DANIO:     "Producto dañado en bodega",
  HURTO:     "Posible hurto",
  UBICACION: "Error de ubicación física",
  DESPACHO:  "Error en despacho a cliente",
};

// ── Turno ────────────────────────────────────────────────
export type Turno = "MAÑANA" | "TARDE" | "NOCHE";
export const TURNOS: Turno[] = ["MAÑANA", "TARDE", "NOCHE"];

// ── Tipo extendido de Novedad ─────────────────────────────
export interface NovedadOperativa {
  tipoNovedad:  TipoNovedad | null;
  causaRaiz:    CausaRaiz | null;
  turno:        Turno | null;
  zonaBodega:   string | null;
  asignadoA:    string | null;
  resueltoAt:   string | null;
  netsuiteAjust:boolean;
  imagenUrl:    string | null;
}

export interface Novedad {
  id: number;
  plu: string;
  posicion: string;
  fecha: string;          // YYYY-MM-DD
  estado: EstadoNovedad;
  descripcion: string | null;
  cantidad: number;       // + sobrante / - faltante
  fabricante: string | null;
  costoUnitario: number | null;
  costoIncidencia: number | null;
  // Campos operativos (Iniciativa 1)
  tipoNovedad:   TipoNovedad | null;
  causaRaiz:     CausaRaiz | null;
  turno:         Turno | null;
  zonaBodega:    string | null;
  asignadoA:     string | null;
  resueltoAt:    string | null;
  netsuiteAjust: boolean;
  netsuiteId:    string | null;
  imagenUrl:     string | null;
}

export function fmtCOP(n: number): string {
  if (!n) return "$0";
  const abs = Math.abs(n);
  return (n < 0 ? "-$" : "$") + abs.toLocaleString("es-CO");
}

export function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export const ESTADO_COLOR: Record<EstadoNovedad, string> = {
  "PENDIENTE": "#B42318",
  "EN PROCESO": "#475569",
  "SOLUCIONADO": "#1D4ED8",
};

export function estadoLabel(e: EstadoNovedad): string {
  return e === "PENDIENTE" ? "Pendiente" : e === "EN PROCESO" ? "En proceso" : "Solucionado";
}
