import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireCan } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const paradaSchema = z.object({
  orden: z.number().int().min(1),
  direccion: z.string().min(1),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  pedidoId: z.string().nullable().optional(),
});

const createSchema = z.object({
  nombre: z.string().min(1).max(255),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  transportistaId: z.string().min(1),
  notas: z.string().nullable().optional(),
  paradas: z.array(paradaSchema).min(1, "Agrega al menos una parada"),
});

function mapRuta(r: any) {
  return {
    id: r.id,
    nombre: r.nombre,
    fecha: r.fecha.toISOString().slice(0, 10),
    transportistaId: r.transportistaId,
    transportista: r.transportista
      ? { id: r.transportista.id, nombre: r.transportista.nombre, telefono: r.transportista.telefono, vehiculo: r.transportista.vehiculo ?? null, userId: r.transportista.userId, activo: r.transportista.activo, vehiculoId: r.transportista.vehiculoId }
      : null,
    estado: r.estado,
    notas: r.notas,
    netsuiteId: r.netsuiteId ?? null,
    createdAt: r.createdAt.toISOString(),
    paradas: (r.paradas ?? []).map((p: any) => ({
      id: p.id, rutaId: p.rutaId, orden: p.orden, direccion: p.direccion,
      lat: p.lat, lng: p.lng, pedidoId: p.pedidoId, estado: p.estado,
      observaciones: p.observaciones, fotoTomada: p.fotoTomada, fotoUrl: p.fotoUrl,
      latEntrega: p.latEntrega, lngEntrega: p.lngEntrega,
      entregadoAt: p.entregadoAt ? p.entregadoAt.toISOString() : null,
    })),
  };
}

// GET /api/logistica/rutas?fecha=YYYY-MM-DD&estado=EN_CURSO&mia=1
export async function GET(req: NextRequest) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;

  const sp = req.nextUrl.searchParams;
  const where: Record<string, unknown> = {};

  if (sp.get("fecha")) where.fecha = new Date(sp.get("fecha")! + "T00:00:00");
  if (sp.get("estado")) where.estado = sp.get("estado");

  // "mia=1" → conductor pide su ruta activa
  if (sp.get("mia") === "1") {
    const t = await prisma.transportista.findUnique({ where: { userId: actor.id } });
    if (!t) return NextResponse.json({ success: true, data: [] });
    where.transportistaId = t.id;
    where.estado = { in: ["PENDIENTE", "EN_CURSO"] };
  }

  const rows = await prisma.ruta.findMany({
    where,
    include: { transportista: { include: { vehiculo: true } }, paradas: { orderBy: { orden: "asc" } } },
    orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ success: true, data: rows.map(mapRuta) });
}

// POST /api/logistica/rutas — crea ruta con paradas
export async function POST(req: NextRequest) {
  const actor = await requireCan("manageLogistica");
  if (actor instanceof NextResponse) return actor;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;

  const ruta = await prisma.$transaction(async (tx) => {
    const r = await tx.ruta.create({
      data: {
        nombre: d.nombre,
        fecha: new Date(d.fecha + "T00:00:00"),
        transportistaId: d.transportistaId,
        notas: d.notas ?? null,
      },
    });
    await tx.parada.createMany({
      data: d.paradas.map((p) => ({
        rutaId: r.id,
        orden: p.orden,
        direccion: p.direccion,
        lat: p.lat ?? null,
        lng: p.lng ?? null,
        pedidoId: p.pedidoId ?? null,
      })),
    });
    return tx.ruta.findUnique({
      where: { id: r.id },
      include: { transportista: { include: { vehiculo: true } }, paradas: { orderBy: { orden: "asc" } } },
    });
  });

  await prisma.activityLog.create({
    data: { userId: actor.id, action: "CREATE", module: "logistica", recordId: ruta!.id, details: d.nombre },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: mapRuta(ruta) }, { status: 201 });
}
