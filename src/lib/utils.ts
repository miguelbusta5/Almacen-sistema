import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCOP(amount: number): string {
  if (amount === 0) return "$0";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function parseDeliveryDate(nota: string | null): string | null {
  if (!nota) return null;
  const match = nota.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (!match) return null;
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

export function daysUntil(isoDate: string): number {
  return Math.floor(
    (new Date(isoDate).getTime() - new Date(today()).getTime()) / 86400000
  );
}

export function urgencyLevel(
  nota: string | null,
  estado: string
): "vencida" | "proxima" | "ok" | null {
  if (estado === "DESPACHADO") return null;
  const entrega = parseDeliveryDate(nota);
  if (!entrega) return null;
  const dias = daysUntil(entrega);
  if (dias < 0) return "vencida";
  if (dias <= 5) return "proxima";
  return "ok";
}
