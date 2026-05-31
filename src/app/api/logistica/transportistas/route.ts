import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireCan } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  nombre: z.string().min(1).max(255),
  telefono: z.string().max(30).nullable().optional(),
  vehiculoId: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
  activo: z.boolean().default(true),
});

function mapRow(r: any) {
  return {
    id: r.id,
    nombre: r.nombre,
    telefono: r.telefono,
    vehiculoId: r.vehiculoId,
    vehiculo: r.vehiculo ?? null,
    userId: r.userId,
    activo: r.activo,
  };
}

export async function GET() {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  const rows = await prisma.transportista.findMany({
    include: { vehiculo: true },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json({ success: true, data: rows.map(mapRow) });
}

export async function POST(req: NextRequest) {
  const actor = await requireCan("manageLogistica");
  if (actor instanceof NextResponse) return actor;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;
  const row = await prisma.transportista.create({
    data: {
      nombre: d.nombre,
      telefono: d.telefono ?? null,
      vehiculoId: d.vehiculoId ?? null,
      userId: d.userId ?? null,
      activo: d.activo,
    },
    include: { vehiculo: true },
  });
  return NextResponse.json({ success: true, data: mapRow(row) }, { status: 201 });
}
