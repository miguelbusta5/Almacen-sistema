import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const postSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  rutaId: z.string().nullable().optional(),
});

// POST /api/logistica/gps — conductor envía su posición
export async function POST(req: NextRequest) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;

  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const transportista = await prisma.transportista.findUnique({ where: { userId: actor.id } });
  if (!transportista) return NextResponse.json({ error: "No eres un transportista registrado" }, { status: 403 });

  await prisma.ubicacionGps.create({
    data: {
      transportistaId: transportista.id,
      rutaId: parsed.data.rutaId ?? null,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
    },
  });

  // Mantener solo las últimas 1000 ubicaciones de este transportista (limpieza)
  const count = await prisma.ubicacionGps.count({ where: { transportistaId: transportista.id } });
  if (count > 1000) {
    const oldest = await prisma.ubicacionGps.findFirst({
      where: { transportistaId: transportista.id },
      orderBy: { registradoAt: "asc" },
    });
    if (oldest) await prisma.ubicacionGps.delete({ where: { id: oldest.id } }).catch(() => {});
  }

  return NextResponse.json({ success: true });
}

// GET /api/logistica/gps — supervisor: última posición de cada transportista activo
export async function GET() {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;

  // Para cada transportista activo, traer su ubicación más reciente
  const transportistas = await prisma.transportista.findMany({
    where: { activo: true },
    include: {
      ubicaciones: {
        orderBy: { registradoAt: "desc" },
        take: 1,
        include: { ruta: { select: { id: true, nombre: true } } },
      },
    },
  });

  const activos = transportistas
    .filter((t) => t.ubicaciones.length > 0)
    .map((t) => {
      const u = t.ubicaciones[0];
      return {
        transportistaId: t.id,
        nombre: t.nombre,
        lat: u.lat,
        lng: u.lng,
        rutaId: u.rutaId,
        rutaNombre: u.ruta?.nombre ?? null,
        registradoAt: u.registradoAt.toISOString(),
      };
    });

  return NextResponse.json({ success: true, data: activos });
}
