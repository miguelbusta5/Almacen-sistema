import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { getCityCoords, normalizeCity } from "@/lib/cityCoordinates";

export interface CiudadMapaDTO {
  nombre: string;
  lat: number;
  lng: number;
  comoOrigen: number;
  comoDestino: number;
  transportadoras: string[];
  total: number;
}

interface CityEvent {
  ciudad: string;
  rol: "origen" | "destino";
  transportadora?: string | null;
}

interface CityAcc {
  nombre: string;
  comoOrigen: number;
  comoDestino: number;
  transportadoras: Set<string>;
}

// ── Adaptadores por fuente ────────────────────────────────

async function solicitudesAdapter(): Promise<CityEvent[]> {
  const rows = await prisma.solicitudTransporte.findMany({
    where: {
      deletedAt: null,
      estado: { notIn: ["RECHAZADA", "CANCELADA"] },
    },
    select: { ciudadOrigen: true, ciudadEntrega: true, transportadora: true },
  });

  const events: CityEvent[] = [];
  for (const r of rows) {
    events.push({ ciudad: r.ciudadOrigen, rol: "origen", transportadora: r.transportadora });
    events.push({ ciudad: r.ciudadEntrega, rol: "destino", transportadora: r.transportadora });
  }
  return events;
}

async function transporteAdapter(): Promise<CityEvent[]> {
  const rows = await prisma.transporteGuardado.findMany({
    where: { ciudad: { not: null } },
    select: { ciudad: true },
  });
  return rows
    .filter((r): r is typeof r & { ciudad: string } => r.ciudad !== null)
    .map((r) => ({ ciudad: r.ciudad, rol: "destino" as const }));
}

async function tiendaAdapter(): Promise<CityEvent[]> {
  const rows = await prisma.despachoTienda.findMany({
    where: { ciudad: { not: null } },
    select: { ciudad: true },
  });
  return rows
    .filter((r): r is typeof r & { ciudad: string } => r.ciudad !== null)
    .map((r) => ({ ciudad: r.ciudad, rol: "destino" as const }));
}

// ── Agregación ────────────────────────────────────────────

function aggregate(events: CityEvent[]): Map<string, CityAcc> {
  const acc = new Map<string, CityAcc>();

  for (const ev of events) {
    const key = normalizeCity(ev.ciudad);
    if (!key) continue;

    if (!acc.has(key)) {
      acc.set(key, { nombre: ev.ciudad, comoOrigen: 0, comoDestino: 0, transportadoras: new Set() });
    }
    const entry = acc.get(key)!;

    if (ev.rol === "origen") entry.comoOrigen++;
    else entry.comoDestino++;

    if (ev.transportadora?.trim()) entry.transportadoras.add(ev.transportadora.trim());
  }

  return acc;
}

// ── Handler ───────────────────────────────────────────────

export async function GET() {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;

  const [solicitudes, transporte, tienda] = await Promise.all([
    solicitudesAdapter(),
    transporteAdapter(),
    tiendaAdapter(),
  ]);

  const allEvents = [...solicitudes, ...transporte, ...tienda];
  const grouped = aggregate(allEvents);

  const ciudades: CiudadMapaDTO[] = [];
  for (const [, entry] of grouped) {
    const coords = getCityCoords(entry.nombre);
    if (!coords) continue; // ciudad sin coordenadas conocidas — ignorar

    ciudades.push({
      nombre: entry.nombre,
      lat: coords.lat,
      lng: coords.lng,
      comoOrigen: entry.comoOrigen,
      comoDestino: entry.comoDestino,
      transportadoras: Array.from(entry.transportadoras).sort(),
      total: entry.comoOrigen + entry.comoDestino,
    });
  }

  // Ordenar por total descendente
  ciudades.sort((a, b) => b.total - a.total);

  return NextResponse.json(
    { ciudades, generatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" } }
  );
}
