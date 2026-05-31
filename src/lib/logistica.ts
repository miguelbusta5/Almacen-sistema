// ════════════════════════════════════════════════
// TIPOS Y UTILIDADES — MÓDULO LOGÍSTICA
// ════════════════════════════════════════════════

export type VehiculoTipo = "CAMION" | "FURGON" | "VAN" | "MOTO";
export type VehiculoEstado = "ACTIVO" | "MANTENIMIENTO" | "INACTIVO";
export type RutaEstado = "PENDIENTE" | "EN_CURSO" | "FINALIZADA" | "CANCELADA";
export type ParadaEstado = "PENDIENTE" | "ENTREGADO" | "NO_ENTREGADO";

export interface Vehiculo {
  id: string;
  placa: string;
  tipo: VehiculoTipo;
  capacidadKg: number | null;
  estado: VehiculoEstado;
}

export interface Transportista {
  id: string;
  nombre: string;
  telefono: string | null;
  vehiculoId: string | null;
  vehiculo: Vehiculo | null;
  userId: string | null;
  activo: boolean;
}

export interface Parada {
  id: string;
  rutaId: string;
  orden: number;
  direccion: string;
  lat: number | null;
  lng: number | null;
  pedidoId: string | null;
  estado: ParadaEstado;
  observaciones: string | null;
  fotoTomada: boolean;
  fotoUrl: string | null;
  latEntrega: number | null;
  lngEntrega: number | null;
  entregadoAt: string | null;
}

export interface Ruta {
  id: string;
  nombre: string;
  fecha: string;
  transportistaId: string;
  transportista: Transportista;
  estado: RutaEstado;
  notas: string | null;
  paradas: Parada[];
  createdAt: string;
}

export interface UbicacionActiva {
  transportistaId: string;
  nombre: string;
  lat: number;
  lng: number;
  rutaId: string | null;
  rutaNombre: string | null;
  registradoAt: string;
}

// ── Labels y colores ──────────────────────────────────

export const RUTA_ESTADO_LABEL: Record<RutaEstado, string> = {
  PENDIENTE: "Pendiente",
  EN_CURSO: "En curso",
  FINALIZADA: "Finalizada",
  CANCELADA: "Cancelada",
};

export const RUTA_ESTADO_COLOR: Record<RutaEstado, string> = {
  PENDIENTE: "#f59e0b",
  EN_CURSO: "#3b82f6",
  FINALIZADA: "#10b981",
  CANCELADA: "#ef4444",
};

export const PARADA_ESTADO_LABEL: Record<ParadaEstado, string> = {
  PENDIENTE: "Pendiente",
  ENTREGADO: "Entregado",
  NO_ENTREGADO: "No entregado",
};

export const PARADA_ESTADO_COLOR: Record<ParadaEstado, string> = {
  PENDIENTE: "#f59e0b",
  ENTREGADO: "#10b981",
  NO_ENTREGADO: "#ef4444",
};

export const VEHICULO_TIPO_LABEL: Record<VehiculoTipo, string> = {
  CAMION: "Camión",
  FURGON: "Furgón",
  VAN: "Van",
  MOTO: "Moto",
};

export const VEHICULO_ESTADO_LABEL: Record<VehiculoEstado, string> = {
  ACTIVO: "Activo",
  MANTENIMIENTO: "En mantenimiento",
  INACTIVO: "Inactivo",
};

export const VEHICULO_ESTADO_COLOR: Record<VehiculoEstado, string> = {
  ACTIVO: "#10b981",
  MANTENIMIENTO: "#f59e0b",
  INACTIVO: "#ef4444",
};

export function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ── URL de navegación Google Maps ─────────────────────
export function navUrl(p: Pick<Parada, "lat" | "lng" | "direccion">): string {
  if (p.lat != null && p.lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.direccion)}`;
}

// ── Algoritmo Nearest Neighbor ────────────────────────
// Haversine: distancia entre dos coordenadas en km.
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Retorna las paradas reordenadas por el algoritmo del vecino más cercano.
// Si alguna parada no tiene coordenadas, devuelve el arreglo sin cambios.
export function nearestNeighbor<T extends { lat: number | null; lng: number | null }>(
  stops: T[]
): T[] {
  if (stops.length <= 1) return stops;
  if (stops.some((s) => s.lat == null || s.lng == null)) return stops;

  const remaining = [...stops];
  const result: T[] = [remaining.splice(0, 1)[0]];

  while (remaining.length > 0) {
    const last = result[result.length - 1];
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(last.lat!, last.lng!, remaining[i].lat!, remaining[i].lng!);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }
    result.push(remaining.splice(nearestIdx, 1)[0]);
  }
  return result;
}

export function canOptimize(paradas: Pick<Parada, "lat" | "lng">[]): boolean {
  return paradas.length >= 2 && paradas.every((p) => p.lat != null && p.lng != null);
}
