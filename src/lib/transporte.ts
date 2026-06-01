// ════════════════════════════════════════════════
// TIPOS Y UTILIDADES DEL MÓDULO TRANSPORTE
// ════════════════════════════════════════════════

export type EstadoTransporte = "PENDIENTE DESPACHO" | "DESPACHADO";

export type TipoGuardado = "COMUN" | "ECOMMERCE";

export interface Guardado {
  id: number;
  clientId: string;
  fecha: string;          // YYYY-MM-DD
  documento: string;
  ubicacion: string;
  estado: EstadoTransporte;
  tipo: TipoGuardado;
  fechaDespacho: string | null; // YYYY-MM-DD
  nota: string | null;
}

// ── Formato ──
export function fmtCOP(n: number): string {
  if (!n) return "$0";
  return "$" + n.toLocaleString("es-CO");
}

export function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Detección de fecha de entrega en la nota ──
// Busca "DD/MM/YYYY" o "DD-MM-YYYY" dentro del texto.
export function parseEntrega(nota: string | null): string | null {
  if (!nota) return null;
  const m = nota.match(/(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

export type Urgencia =
  | { tipo: "vencida"; dias: number; entrega: string }
  | { tipo: "proxima"; dias: number; entrega: string }
  | { tipo: "ok"; dias: number; entrega: string }
  | null;

// Alerta cuando faltan ≤5 días para la entrega (o ya venció).
export function urgencia(g: Guardado): Urgencia {
  if (g.estado === "DESPACHADO") return null;
  const entrega = parseEntrega(g.nota);
  if (!entrega) return null;
  const diff = new Date(todayISO()).getTime() - new Date(entrega).getTime();
  const dNum = Math.floor(diff / 86400000);
  if (dNum > 0) return { tipo: "vencida", dias: dNum, entrega };
  if (dNum >= -5) return { tipo: "proxima", dias: -dNum, entrega };
  return { tipo: "ok", dias: -dNum, entrega };
}

export function tieneAlerta(g: Guardado): boolean {
  const u = urgencia(g);
  return u !== null && (u.tipo === "vencida" || u.tipo === "proxima");
}
