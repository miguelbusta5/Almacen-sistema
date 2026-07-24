import type { UserRole } from "@/types";
import { canSeeModule } from "./modulePermissions";

export const SOLICITUDES_TRANSPORTE_PATH = "/dashboard/solicitudes-transporte";

export const AREA_SOLICITANTE_OPTIONS = [
  "Garantias",
  "Muebles",
  "Despachos",
  "Gourmet",
  "Grandes Superficies",
  "Averias",
  "Visual",
  "Tiendas",
  "Ecommerce",
  "Mercadeo",
  "Otro",
] as const;

export const CIUDAD_OPTIONS = [
  "Bogota D.C.",
  "Medellin",
  "Cali",
  "Barranquilla",
  "Cartagena",
  "Bucaramanga",
  "Pereira",
  "Manizales",
  "Armenia",
  "Cucuta",
  "Ibague",
  "Santa Marta",
  "Villavicencio",
  "Pasto",
  "Monteria",
  "Sincelejo",
  "Valledupar",
  "Neiva",
  "Tunja",
  "Popayan",
  "Riohacha",
  "Quibdo",
  "Yopal",
  "Florencia",
  "San Andres",
] as const;

export const TIPO_VENTA_OPTIONS = ["Contado", "Interalmacen", "N/A"] as const;
export const ZONA_OPTIONS = ["Urbana", "Rural"] as const;
export const VOLUMEN_OPTIONS = ["Grande", "Mediano", "Pequeno"] as const;
export const TIPO_MERCANCIA_OPTIONS = ["Muebles", "Paqueteria", "Mixto"] as const;
export const VENTANA_ENTREGA_OPTIONS = ["Horario A.M", "Horario P.M"] as const;
export const TIPO_SERVICIO_OPTIONS = [
  "Entrega directa",
  "Recoleccion",
  "Traslado entre sedes",
  "Logistica inversa",
  "Otro",
] as const;

export const TRANSPORTADORA_OPTIONS = [
  "ONE SITE",
  "TRANSTELITAL",
  "V2 TOGO",
  "PROPIO",
  "PROESLOG",
  "PAKING TO GO",
  "NOTA INTERNA",
] as const;

export type TransportadoraSolicitudTransporte = typeof TRANSPORTADORA_OPTIONS[number];

export interface PluSolicitudInput {
  plu: string;
  descripcion: string;
  unidades: number;
}

export const PUNTO_RECOGIDA_OPTIONS = [
  "109 AG Oviedo",
  "111 AG Santafe Bogota",
  "113 AG El Tesoro",
  "114 AG Gran Estacion",
  "117 AG El Retiro",
  "118 AG Calle 109",
  "120 AG Santafe Medellin",
  "121 AG Unicentro",
  "126 AG El Tesoro 2",
  "128 AG Viva Laureles",
  "130 AG Palatino",
  "138 AL El Tesoro",
  "140 AG Fontanar",
  "141 AL Calle 109",
  "142 CH Mayorca",
  "144 AG Viva Barranquilla",
  "148 Outlet Sopo",
  "149 LOFT viva envigado",
  "150 AG Viva Envigado",
  "152 CH Atlantis",
  "154 AL Casa Barranquilla",
  "155 CH Nuestro Bogota",
  "156 AL Fontanar",
  "157 AP Le Mont",
  "158 AG Unicentro 2",
  "160 AG Mall Plaza Barranquilla",
  "162 AG La Colina",
  "164 AG Salitre",
  "201 AG Pereira Plaza",
  "202 AG Nao Bocagrande",
  "210 AG Manizales",
  "211 AG Portal del Quindio",
  "218 AG Parque Arboleda",
  "220 AG Cacique",
  "223 AG Buenavista Santa Marta",
  "227 AG Mall Plaza Cartagena",
  "230 AG Buenavista Monteria",
  "231 AG Campanario Popayan",
  "998 Ecommerce",
  "90 Cedi",
  "OFICINA",
  "VENTAS WHATSAPP",
  "MERCADEO-PUBLICIDAD",
  "Otros",
] as const;

export const GESTORES_SOLICITUDES_TRANSPORTE: UserRole[] = [
  "ADMIN",
  "GERENTE",
  "SUPERVISOR_TRANSPORTE",
];

// Antes era allow-by-default ("cualquiera menos TRANSPORTISTA"), asi que roles sin
// el modulo en el sidebar igual podian entrar por URL y crear. Ahora la matriz de
// modulePermissions.ts es la unica fuente: si no ves el modulo, no operas sobre el.
export function puedeCrearSolicitudTransporte(role: UserRole | string | undefined | null): boolean {
  return canSeeModule(role, "solicitudes-transporte");
}

export function puedeGestionarSolicitudTransporte(role: UserRole | string | undefined | null): boolean {
  return Boolean(role && (GESTORES_SOLICITUDES_TRANSPORTE as string[]).includes(role));
}

export function puedeEliminarSolicitudTransporte(role: UserRole | string | undefined | null): boolean {
  return role === "ADMIN" || role === "GERENTE";
}

export function puedeVerSolicitudTransporte(
  role: UserRole | string | undefined | null,
  actorId: string | undefined | null,
  creadoPorId: string | undefined | null
): boolean {
  if (!canSeeModule(role, "solicitudes-transporte")) return false;
  if (puedeGestionarSolicitudTransporte(role)) return true;
  return Boolean(actorId && creadoPorId && actorId === creadoPorId);
}

export function parseDateOnly(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T00:00:00`);
}

export function formatDateOnly(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function daysBetween(from: Date, to: Date): number {
  const fromUtc = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const toUtc = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((toUtc - fromUtc) / 86_400_000);
}

export function calcularPrioridadSolicitudTransporte(
  fechaSolicitud: Date | null | undefined,
  fechaPromesaEntrega: Date | null | undefined
): "ALTO" | "MEDIO" | "BAJO" | null {
  if (!fechaSolicitud || !fechaPromesaEntrega) return null;
  const diff = daysBetween(fechaSolicitud, fechaPromesaEntrega);
  if (diff < 4) return "ALTO";
  if (diff < 6) return "MEDIO";
  return "BAJO";
}

export function calcularSemaforoSolicitudTransporte(params: {
  stellaEstado: "PENDIENTE" | "PROGRAMADO" | "EFECTUADO" | "CANCELADO";
  fechaPromesaEntrega?: Date | null;
  hoy?: Date;
}): "SIN_FECHA" | "VENCIDO" | "ALERTA" | "NORMAL" | "EFECTUADO" | "CANCELADO" {
  if (params.stellaEstado === "EFECTUADO") return "EFECTUADO";
  if (params.stellaEstado === "CANCELADO") return "CANCELADO";
  if (!params.fechaPromesaEntrega) return "SIN_FECHA";
  const hoy = params.hoy ?? new Date();
  const diff = daysBetween(hoy, params.fechaPromesaEntrega);
  if (diff < 0) return "VENCIDO";
  if (diff <= 2) return "ALERTA";
  return "NORMAL";
}

export function mesSolicitud(fechaSolicitud: Date | null | undefined): string | null {
  if (!fechaSolicitud) return null;
  return fechaSolicitud.toLocaleDateString("es-CO", { month: "long", timeZone: "UTC" });
}

export function estadoDesdeStella(stellaEstado: "PENDIENTE" | "PROGRAMADO" | "EFECTUADO" | "CANCELADO") {
  if (stellaEstado === "PROGRAMADO") return "PROGRAMADA" as const;
  if (stellaEstado === "EFECTUADO") return "EFECTUADA" as const;
  if (stellaEstado === "CANCELADO") return "CANCELADA" as const;
  return "PENDIENTE" as const;
}

export function esTransportadoraValida(value: string | null | undefined): value is TransportadoraSolicitudTransporte {
  return Boolean(value && (TRANSPORTADORA_OPTIONS as readonly string[]).includes(value));
}

export function validarFlete(cobroFlete: boolean | null | undefined, valorFlete: number | null | undefined): string | null {
  if (typeof cobroFlete !== "boolean") return "Debes indicar si se cobro flete";
  if (cobroFlete && (valorFlete === null || valorFlete === undefined || Number.isNaN(valorFlete) || valorFlete < 0)) {
    return "Debes ingresar el valor del flete";
  }
  return null;
}

export function validarPlinesSolicitudTransporte(plines: PluSolicitudInput[] | null | undefined): string | null {
  if (!plines || plines.length === 0) return "Agrega al menos un PLU";
  for (const item of plines) {
    if (!item.plu.trim()) return "Cada linea debe tener PLU";
    if (!item.descripcion.trim()) return "Cada linea debe tener descripcion";
    if (!Number.isInteger(item.unidades) || item.unidades < 1) return "Cada linea debe tener unidades validas";
  }
  return null;
}
