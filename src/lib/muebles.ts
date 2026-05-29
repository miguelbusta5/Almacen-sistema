// ════════════════════════════════════════════════
// TIPOS Y UTILIDADES DEL MÓDULO NOVEDADES MUEBLES
// Novedad = diferencia de inventario (PLU en una posición
// con una cantidad +/- y un estado de resolución).
// ════════════════════════════════════════════════

export type EstadoNovedad = "PENDIENTE" | "EN PROCESO" | "SOLUCIONADO";

export const ESTADOS: EstadoNovedad[] = ["PENDIENTE", "EN PROCESO", "SOLUCIONADO"];

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
  "PENDIENTE": "#ef4444",
  "EN PROCESO": "#f59e0b",
  "SOLUCIONADO": "#10b981",
};

export function estadoLabel(e: EstadoNovedad): string {
  return e === "PENDIENTE" ? "Pendiente" : e === "EN PROCESO" ? "En proceso" : "Solucionado";
}
