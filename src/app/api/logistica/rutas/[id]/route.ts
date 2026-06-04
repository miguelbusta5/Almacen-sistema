import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireCan } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { nearestNeighbor } from "@/lib/logistica";

const updateSchema = z.object({
  nombre: z.string().min(1).max(255).optional(),
  estado: z.enum(["PENDIENTE", "EN_CURSO", "FINALIZADA", "CANCELADA"]).optional(),
  notas: z.string().nullable().optional(),
  netsuiteId: z.string().max(100).nullable().optional(),
  transportistaId: z.string().optional(),
  optimizar: z.boolean().optional(),
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

// GET /api/logistica/rutas/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;
  const row = await prisma.ruta.findUnique({
    where: { id },
    include: { transportista: { include: { vehiculo: true } }, paradas: { orderBy: { orden: "asc" } } },
  });
  if (!row) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  return NextResponse.json({ success: true, data: mapRuta(row) });
}

// PUT /api/logistica/rutas/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireCan("manageLogistica");
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { optimizar, ...data } = parsed.data;

  const row = await prisma.$transaction(async (tx) => {
    const r = await tx.ruta.update({
      where: { id },
      data,
      include: { transportista: { include: { vehiculo: true } }, paradas: { orderBy: { orden: "asc" } } },
    });
    // Reordenar paradas con nearest-neighbor si se solicita
    if (optimizar && r.paradas.length >= 2) {
      const ordered = nearestNeighbor(r.paradas);
      await Promise.all(
        ordered.map((p, i) => tx.parada.update({ where: { id: p.id }, data: { orden: i + 1 } }))
      );
      r.paradas = ordered.map((p, i) => ({ ...p, orden: i + 1 }));
    }
    return r;
  });

  await prisma.activityLog.create({
    data: { userId: actor.id, action: "UPDATE", module: "logistica", recordId: id, details: data.estado ?? "actualizada" },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: mapRuta(row) });
}

// DELETE /api/logistica/rutas/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireCan("delete");
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;
  try {
    await prisma.ruta.delete({ where: { id } });
    await prisma.activityLog.create({
      data: { userId: actor.id, action: "DELETE", module: "logistica", recordId: id, details: "ruta eliminada" },
    }).catch(() => {});
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: "No encontrada" }, { status: 404 }); }
}
