// ════════════════════════════════════════════════
// TIPOS Y UTILIDADES — portado desde la app Next.js (transporte.ts)
// ════════════════════════════════════════════════
import dayjs from 'dayjs';
import { calcAlmacenaje } from './almacenaje';

export type EstadoTransporte = 'PENDIENTE DESPACHO' | 'DESPACHADO';
export type TipoGuardado = 'COMUN' | 'ECOMMERCE';

export interface Guardado {
  id: number;
  clientId: string;
  fecha: string;
  documento: string;
  ubicacion: string;
  estado: EstadoTransporte;
  tipo: TipoGuardado;
  fechaDespacho: string | null;
  nota: string | null;
  ciudad: string | null;
  codigoTienda: string | null;
  nombreTienda: string | null;
  netsuiteId: string | null;
}

export function fmtCOP(n: number): string {
  if (!n) return '$0';
  return '$' + n.toLocaleString('es-CO');
}
export function fmtFecha(iso: string | null): string {
  if (!iso) return '—';
  return dayjs(iso).format('DD/MM/YYYY');
}
export function todayISO(): string {
  return dayjs().format('YYYY-MM-DD');
}
export function diasEnBodega(g: { fecha: string }): number {
  return dayjs().startOf('day').diff(dayjs(g.fecha).startOf('day'), 'day');
}

export function parseEntrega(nota: string | null): string | null {
  if (!nota) return null;
  const m = nota.match(/(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
}

export type Urgencia =
  | { tipo: 'vencida'; dias: number; entrega: string }
  | { tipo: 'proxima'; dias: number; entrega: string }
  | { tipo: 'ok'; dias: number; entrega: string }
  | null;

export function urgencia(g: { estado: string; nota: string | null }): Urgencia {
  if (g.estado === 'DESPACHADO') return null;
  const entrega = parseEntrega(g.nota);
  if (!entrega) return null;
  const dNum = dayjs(todayISO()).diff(dayjs(entrega), 'day');
  if (dNum > 0) return { tipo: 'vencida', dias: dNum, entrega };
  if (dNum >= -5) return { tipo: 'proxima', dias: -dNum, entrega };
  return { tipo: 'ok', dias: -dNum, entrega };
}
export type EntregaColorNivel = 'neutro' | 'sin-fecha' | 'vencida' | 'amarillo' | 'azul' | 'verde';

export function nivelEntregaColorFecha(fechaEntrega: string | null, neutro: boolean): EntregaColorNivel {
  if (!fechaEntrega) return 'sin-fecha';
  if (neutro) return 'neutro';
  const diasRestantes = dayjs(fechaEntrega).diff(dayjs(todayISO()), 'day');
  if (diasRestantes < 0) return 'vencida';
  if (diasRestantes <= 10) return 'amarillo';
  if (diasRestantes <= 15) return 'azul';
  return 'verde';
}
export function nivelEntregaColor(g: { estado: string; nota: string | null }): EntregaColorNivel {
  return nivelEntregaColorFecha(parseEntrega(g.nota), g.estado === 'DESPACHADO');
}

export function tieneAlerta(g: Guardado): boolean {
  const u = urgencia(g);
  return u !== null && (u.tipo === 'vencida' || u.tipo === 'proxima');
}

export function scoreGuardado(g: Guardado): number {
  if (g.estado === 'DESPACHADO') return 0;
  const dias = diasEnBodega(g);
  const alm = calcAlmacenaje(g.fecha, null);
  const u = urgencia(g);
  let score = 0;
  score += Math.min(35, dias * 0.45);
  score += Math.min(35, (alm.costo / 300_000) * 10);
  if (u?.tipo === 'vencida') score += 30;
  else if (u?.tipo === 'proxima' && (u.dias ?? 10) <= 2) score += 22;
  else if (u?.tipo === 'proxima') score += 12;
  return Math.min(100, Math.round(score));
}

export type AlertaTier = 'ok' | 'aviso' | 'alerta' | 'critico' | 'emergencia';

export function alertaTier(g: Guardado): AlertaTier {
  if (g.estado === 'DESPACHADO') return 'ok';
  const dias = diasEnBodega(g);
  if (dias >= 90) return 'emergencia';
  if (dias >= 60) return 'critico';
  if (dias >= 45) return 'alerta';
  if (dias >= 25) return 'aviso';
  return 'ok';
}

export const ALERTA_TIER_LABEL: Record<AlertaTier, string> = {
  ok: 'En gracia',
  aviso: 'Gracia venciendo',
  alerta: 'Alto costo',
  critico: 'Mercancía en riesgo',
  emergencia: 'Posible abandono',
};

// Rampa de calor unificada del piloto (var de tokens.css).
export const TIER_COLOR: Record<AlertaTier, string> = {
  ok: 'var(--u-ok)',
  aviso: 'var(--u-aviso)',
  alerta: 'var(--u-alerta)',
  critico: 'var(--u-critico)',
  emergencia: 'var(--u-emergencia)',
};
export const TIER_TINT: Record<AlertaTier, string> = {
  ok: 'var(--u-ok-tint)',
  aviso: 'var(--u-aviso-tint)',
  alerta: 'var(--u-alerta-tint)',
  critico: 'var(--u-critico-tint)',
  emergencia: 'var(--u-emergencia-tint)',
};

// ── Contactos ──
export type TipoContacto = 'LLAMADA' | 'MENSAJE' | 'EMAIL' | 'VISITA' | 'ESCALACION';
export type ResultadoContacto = 'NO_CONTESTA' | 'CONFIRMO_FECHA' | 'CANCELO' | 'ESCALADO' | 'OTRO';

export const TIPO_CONTACTO_LABEL: Record<TipoContacto, string> = {
  LLAMADA: 'Llamada telefónica',
  MENSAJE: 'Mensaje (WhatsApp/SMS)',
  EMAIL: 'Correo electrónico',
  VISITA: 'Visita presencial',
  ESCALACION: 'Escalación interna',
};
export const RESULTADO_CONTACTO_LABEL: Record<ResultadoContacto, string> = {
  NO_CONTESTA: 'No contestó',
  CONFIRMO_FECHA: 'Confirmó fecha de recogida',
  CANCELO: 'Canceló / Rechazó',
  ESCALADO: 'Se escaló a otra área',
  OTRO: 'Otro resultado',
};

export interface ContactoGuardado {
  id: string;
  guardadoClientId: string;
  tipo: TipoContacto;
  resultado: ResultadoContacto;
  fechaCompromiso: string | null;
  nota: string | null;
  registradoPorNombre?: string;
  createdAt: string;
}
