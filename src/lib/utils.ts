import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function fmtCOP(value: number): string {
  if (value === 0) return "$0";
  return "$" + value.toLocaleString("es-CO");
}

export function fmtFecha(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function diasDesde(fecha: string): number {
  return Math.floor((new Date(today()).getTime() - new Date(fecha).getTime()) / 86400000);
}
