// ════════════════════════════════════════════════
// TIPOS Y UTILIDADES — MÓDULO CONTEO CÍCLICO
// ════════════════════════════════════════════════

export type CicloEstado = "PLANIFICADO" | "EN_PROGRESO" | "EN_RECONTEO" | "CERRADO";
export type LineaEstado = "PENDIENTE" | "CONTADO" | "EN_RECONTEO" | "OK" | "NOVEDAD";

export interface CicloConteo {
  id: string;
  nombre: string;
  fechaInicio: string;         // YYYY-MM-DD
  estado: CicloEstado;
  totalLineas: number;
  notas: string | null;
  createdAt: string;
  // KPIs calculados
  pendientes?: number;
  contados?: number;
  enReconteo?: number;
  ok?: number;
  novedades?: number;
  autoFill?: number;
}

export interface LineaConteo {
  id: string;
  cicloId: string;
  plu: string;
  descripcion: string;
  marca: string | null;
  codigoBarras: string | null;
  ubicacion: string;
  tipoPasillo: string;
  autoFill: boolean;
  teorico: number;
  precioBase: number | null;
  ultimoPrecio: number | null;
  operarioNombre: string | null;
  diaAsignado: number | null;
  estado: LineaEstado;
  cajas: number | null;
  undEmp: number | null;
  reguero: number | null;
  cantidadContada: number | null;
  contadoPor: string | null;
  contadoAt: string | null;
  cantidadRecontada: number | null;
  recontadoPor: string | null;
  recontadoAt: string | null;
  diferenciaFinal: number | null;
}

export interface OperarioCiclo {
  id: string;
  nombre: string;
  activo: boolean;
}

// ── Labels y colores ─────────────────────────────────

export const CICLO_ESTADO_LABEL: Record<CicloEstado, string> = {
  PLANIFICADO: "Planificado",
  EN_PROGRESO: "En progreso",
  EN_RECONTEO: "En reconteo",
  CERRADO: "Cerrado",
};

export const CICLO_ESTADO_COLOR: Record<CicloEstado, string> = {
  PLANIFICADO: "#f59e0b",
  EN_PROGRESO: "#3b82f6",
  EN_RECONTEO: "#7c3aed",
  CERRADO: "#10b981",
};

export const LINEA_ESTADO_LABEL: Record<LineaEstado, string> = {
  PENDIENTE: "Pendiente",
  CONTADO: "Contado",
  EN_RECONTEO: "En reconteo",
  OK: "OK",
  NOVEDAD: "Novedad",
};

export const LINEA_ESTADO_COLOR: Record<LineaEstado, string> = {
  PENDIENTE: "#94a3b8",
  CONTADO: "#3b82f6",
  EN_RECONTEO: "#7c3aed",
  OK: "#10b981",
  NOVEDAD: "#ef4444",
};

export const COLOR_CONTEO = "#16a34a";

// ── Cálculo de cantidad contada ───────────────────────
// Si el operario ingresó cajas/undEmp/reguero → calcula
// Si ingresó total directo → usa ese valor
export function calcularCantidad(
  cajas: number | null,
  undEmp: number | null,
  reguero: number | null,
  total: number | null
): number | null {
  if (cajas != null && undEmp != null) {
    return (cajas * undEmp) + (reguero ?? 0);
  }
  return total;
}

// ── Formateo ─────────────────────────────────────────
export function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function fmtNum(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString("es-CO");
}

export function fmtCOP(n: number | null): string {
  if (n == null) return "—";
  return "$" + Math.abs(n).toLocaleString("es-CO");
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Detección de columnas del CSV del WMS ────────────
// Mapea nombres de cabecera del CSV a campos del sistema
// Soporta dos formatos: WMS directo y hoja Teórico de Sheets
export type CsvColMap = {
  plu: number;
  descripcion: number;
  ubicacion: number;
  teorico: number;
  tipoPasillo: number | null;
  marca: number | null;
  codigoBarras: number | null;
  precioBase: number | null;
  ultimoPrecio: number | null;
};

const COL_ALIASES: Record<keyof CsvColMap, string[]> = {
  plu:          ["ARTÍCULO", "PLU", "Artículo", "plu", "articulo"],
  descripcion:  ["NOMBRE PARA MOSTRAR", "Nombre para mostrar", "descripcion", "DESCRIPCION"],
  ubicacion:    ["NÚMERO DE DEPÓSITO", "Número de depósito", "Código de ubicación", "codigo_ubicacion", "ubicacion"],
  teorico:      ["DISPONIBLE", "Teórico", "teorico", "TEORICO", "Disponible"],
  tipoPasillo:  ["WMS: PASILLO", "WMS:PASILLO", "Pasillo", "pasillo"],
  marca:        ["Fabricante", "FABRICANTE", "Marca", "marca"],
  codigoBarras: ["Código UPC", "CÓDIGO UPC", "Barra", "barra", "barcode"],
  precioBase:   ["Precio base", "PRECIO BASE", "precio_base"],
  ultimoPrecio: ["Último precio de compra", "ÚLTIMO PRECIO DE COMPRA", "ultimo_precio"],
};

export function detectarColumnas(headers: string[]): CsvColMap | null {
  const norm = headers.map((h) => h.trim());
  function find(aliases: string[]): number | null {
    for (const alias of aliases) {
      const i = norm.findIndex((h) => h.toLowerCase() === alias.toLowerCase());
      if (i >= 0) return i;
    }
    return null;
  }
  const plu = find(COL_ALIASES.plu);
  const descripcion = find(COL_ALIASES.descripcion);
  const ubicacion = find(COL_ALIASES.ubicacion);
  const teorico = find(COL_ALIASES.teorico);
  if (plu == null || descripcion == null || ubicacion == null || teorico == null) return null;
  return {
    plu,
    descripcion,
    ubicacion,
    teorico,
    tipoPasillo: find(COL_ALIASES.tipoPasillo),
    marca: find(COL_ALIASES.marca),
    codigoBarras: find(COL_ALIASES.codigoBarras),
    precioBase: find(COL_ALIASES.precioBase),
    ultimoPrecio: find(COL_ALIASES.ultimoPrecio),
  };
}

// auto_fill si el pasillo NO es "Almacenamiento"
export function esAutoFill(tipoPasillo: string | null): boolean {
  if (!tipoPasillo) return false;
  return tipoPasillo.toLowerCase() !== "almacenamiento";
}
