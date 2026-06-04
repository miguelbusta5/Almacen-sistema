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
  netsuiteId: string | null;
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

// ── Scoring de urgencia (0-100) ──────────────────────────
// Determina prioridad: qué guardado atender primero.
import { calcAlmacenaje } from "@/lib/almacenaje";

export function scoreGuardado(g: Guardado): number {
  if (g.estado === "DESPACHADO") return 0;
  const dias = Math.floor((Date.now() - new Date(g.fecha + "T00:00:00").getTime()) / 86_400_000);
  const alm = calcAlmacenaje(g.fecha, null);
  const u = urgencia(g);
  let score = 0;
  // Tiempo en bodega (0-35 pts)
  score += Math.min(35, dias * 0.45);
  // Costo acumulado (0-35 pts)
  score += Math.min(35, (alm.costo / 150_000) * 10);
  // Urgencia de entrega comprometida (0-30 pts)
  if (u?.tipo === "vencida")  score += 30;
  else if (u?.tipo === "proxima" && (u.dias ?? 10) <= 2) score += 22;
  else if (u?.tipo === "proxima") score += 12;
  return Math.min(100, Math.round(score));
}

// ── Nivel de alerta escalonada por días en bodega ────────
export type AlertaTier = "ok" | "aviso" | "alerta" | "critico" | "emergencia";

export function alertaTier(g: Guardado): AlertaTier {
  if (g.estado === "DESPACHADO") return "ok";
  const dias = Math.floor((Date.now() - new Date(g.fecha + "T00:00:00").getTime()) / 86_400_000);
  if (dias >= 90) return "emergencia";
  if (dias >= 60) return "critico";
  if (dias >= 45) return "alerta";
  if (dias >= 25) return "aviso";
  return "ok";
}

export const ALERTA_TIER_LABEL: Record<AlertaTier, string> = {
  ok:        "En gracia",
  aviso:     "Gracia venciendo",
  alerta:    "Alto costo",
  critico:   "Mercancía en riesgo",
  emergencia:"Posible abandono",
};

export const ALERTA_TIER_COLOR: Record<AlertaTier, string> = {
  ok:        "#10b981",
  aviso:     "#f59e0b",
  alerta:    "#ef4444",
  critico:   "#dc2626",
  emergencia:"#7f1d1d",
};

// ── Tipos para log de contacto ───────────────────────────
export type TipoContacto = "LLAMADA" | "MENSAJE" | "EMAIL" | "VISITA" | "ESCALACION";
export type ResultadoContacto = "NO_CONTESTA" | "CONFIRMO_FECHA" | "CANCELO" | "ESCALADO" | "OTRO";

export const TIPO_CONTACTO_LABEL: Record<TipoContacto, string> = {
  LLAMADA:    "Llamada telefónica",
  MENSAJE:    "Mensaje (WhatsApp/SMS)",
  EMAIL:      "Correo electrónico",
  VISITA:     "Visita presencial",
  ESCALACION: "Escalación interna",
};

export const RESULTADO_CONTACTO_LABEL: Record<ResultadoContacto, string> = {
  NO_CONTESTA:    "No contestó",
  CONFIRMO_FECHA: "Confirmó fecha de recogida",
  CANCELO:        "Canceló / Rechazó",
  ESCALADO:       "Se escaló a otro área",
  OTRO:           "Otro resultado",
};

export interface ContactoGuardado {
  id: string;
  guardadoClientId: string;
  tipo: TipoContacto;
  resultado: ResultadoContacto;
  fechaCompromiso: string | null;
  nota: string | null;
  registradoPor: string;
  registradoPorNombre?: string;
  createdAt: string;
}
