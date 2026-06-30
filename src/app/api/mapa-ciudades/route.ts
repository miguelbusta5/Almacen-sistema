import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { getCityCoords, normalizeCity } from "@/lib/cityCoordinates";

export interface TransportadoraCount {
  nombre: string;
  count: number;
}

export interface CiudadMapaDTO {
  nombre: string;
  lat: number;
  lng: number;
  comoOrigen: number;
  comoDestino: number;
  transportadoras: TransportadoraCount[];
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
  transportadoras: Map<string, number>;
}

type DateFilter = { gte?: Date; lte?: Date };

// ── Adaptadores por fuente ────────────────────────────────

async function solicitudesAdapter(fecha: DateFilter): Promise<CityEvent[]> {
  const rows = await prisma.solicitudTransporte.findMany({
    where: {
      deletedAt: null,
      estado: { notIn: ["RECHAZADA", "CANCELADA"] },
      ...(fecha.gte || fecha.lte ? { createdAt: fecha } : {}),
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

async function transporteAdapter(fecha: DateFilter): Promise<CityEvent[]> {
  const rows = await prisma.transporteGuardado.findMany({
    where: {
      ciudad: { not: null },
      ...(fecha.gte || fecha.lte ? { createdAt: fecha } : {}),
    },
    select: { ciudad: true },
  });
  return rows
    .filter((r): r is typeof r & { ciudad: string } => r.ciudad !== null)
    .map((r) => ({ ciudad: r.ciudad, rol: "destino" as const }));
}

async function tiendaAdapter(fecha: DateFilter): Promise<CityEvent[]> {
  const rows = await prisma.despachoTienda.findMany({
    where: {
      ciudad: { not: null },
      ...(fecha.gte || fecha.lte ? { createdAt: fecha } : {}),
    },
    select: { ciudad: true },
  });
  return rows
    .filter((r): r is typeof r & { ciudad: string } => r.ciudad !== null)
    .map((r) => ({ ciudad: r.ciudad, rol: "destino" as const }));
}

// Registry de fuentes — agregar nuevas fuentes es una línea aquí.
const ADAPTERS: Record<string, (f: DateFilter) => Promise<CityEvent[]>> = {
  solicitudes: solicitudesAdapter,
  transporte: transporteAdapter,
  tienda: tiendaAdapter,
};

const DEFAULT_FUENTES = ["solicitudes", "transporte", "tienda"];

// ── Agregación ────────────────────────────────────────────

function aggregate(events: CityEvent[]): Map<string, CityAcc> {
  const acc = new Map<string, CityAcc>();

  for (const ev of events) {
    const key = normalizeCity(ev.ciudad);
    if (!key) continue;

    if (!acc.has(key)) {
      acc.set(key, { nombre: ev.ciudad, comoOrigen: 0, comoDestino: 0, transportadoras: new Map() });
    }
    const entry = acc.get(key)!;

    if (ev.rol === "origen") entry.comoOrigen++;
    else entry.comoDestino++;

    const t = ev.transportadora?.trim();
    if (t) entry.transportadoras.set(t, (entry.transportadoras.get(t) ?? 0) + 1);
  }

  return acc;
}

// ── Handler ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;

  const { searchParams } = req.nextUrl;

  // Fuentes solicitadas (default: todas las conocidas)
  const fuentesParam = searchParams.get("fuentes");
  const fuentes = (fuentesParam ? fuentesParam.split(",") : DEFAULT_FUENTES)
    .map((f) => f.trim())
    .filter((f) => f in ADAPTERS);

  // Rango de fechas opcional sobre createdAt
  const fecha: DateFilter = {};
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  if (desde && /^\d{4}-\d{2}-\d{2}$/.test(desde)) fecha.gte = new Date(`${desde}T00:00:00.000Z`);
  if (hasta && /^\d{4}-\d{2}-\d{2}$/.test(hasta)) fecha.lte = new Date(`${hasta}T23:59:59.999Z`);

  const eventLists = await Promise.all(fuentes.map((f) => ADAPTERS[f](fecha)));
  const grouped = aggregate(eventLists.flat());

  const ciudades: CiudadMapaDTO[] = [];
  for (const [, entry] of grouped) {
    const coords = getCityCoords(entry.nombre);
    if (!coords) continue; // ciudad sin coordenadas conocidas — ignorar

    const transportadoras: TransportadoraCount[] = Array.from(entry.transportadoras.entries())
      .map(([nombre, count]) => ({ nombre, count }))
      .sort((a, b) => b.count - a.count || a.nombre.localeCompare(b.nombre));

    ciudades.push({
      nombre: entry.nombre,
      lat: coords.lat,
      lng: coords.lng,
      comoOrigen: entry.comoOrigen,
      comoDestino: entry.comoDestino,
      transportadoras,
      total: entry.comoOrigen + entry.comoDestino,
    });
  }

  ciudades.sort((a, b) => b.total - a.total);

  return NextResponse.json(
    { ciudades, generatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" } }
  );
}
