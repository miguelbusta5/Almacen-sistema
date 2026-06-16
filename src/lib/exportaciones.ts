import type { UserRole } from "@/types";
import { GESTORES_EXPORTACIONES, USUARIOS_EXPORTACIONES } from "@/lib/roles";

export const EXPORTACIONES_PATH = "/dashboard/exportaciones";

export function puedeUsarExportaciones(role: UserRole | string | null | undefined): boolean {
  return Boolean(role && (USUARIOS_EXPORTACIONES as readonly string[]).includes(role));
}

export function puedeGestionarExportaciones(role: UserRole | string | null | undefined): boolean {
  return Boolean(role && (GESTORES_EXPORTACIONES as readonly string[]).includes(role));
}

export function normalizePlu(value: string): string {
  return value.trim().toUpperCase();
}

export function todayBogota(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return new Date(`${parts}T00:00:00.000Z`);
}

export function formatDateOnly(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function calcularDuracionMinutos(inicio: Date | string, fin: Date | string | null | undefined): number | null {
  if (!fin) return null;
  const start = inicio instanceof Date ? inicio : new Date(inicio);
  const end = fin instanceof Date ? fin : new Date(fin);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

export function validarCapturaExportacion(input: {
  numeroCaja?: string | null;
  plu?: string | null;
  unidadEmpaque?: number | null;
}): string | null {
  if (!input.numeroCaja?.trim()) return "Numero de caja es obligatorio";
  if (!input.plu?.trim()) return "PLU es obligatorio";
  if (!Number.isInteger(input.unidadEmpaque) || (input.unidadEmpaque ?? 0) < 1) {
    return "Unidad de empaque debe ser un entero mayor a cero";
  }
  return null;
}
