import { NextRequest, NextResponse } from "next/server";
import { requireCan } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const asignarSchema = z.object({
  // Asignar un bloque: todas las líneas con ubicacion en rango A→Z
  ubicacionDesde: z.string().min(1),
  ubicacionHasta: z.string().min(1),
  operarioNombre: z.string().min(1),
  diaAsignado: z.number().int().min(1).max(4),
});

// POST /api/conteo/ciclos/[id]/asignar
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireCan("manageConteo");
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;
  const body = await req.json();
  const parsed = asignarSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { ubicacionDesde, ubicacionHasta, operarioNombre, diaAsignado } = parsed.data;

  // Actualizar todas las líneas físicas (no auto-fill) cuya ubicacion está en el rango
  const result = await prisma.lineaConteo.updateMany({
    where: {
      cicloId: id,
      autoFill: false,
      ubicacion: { gte: ubicacionDesde, lte: ubicacionHasta },
    },
    data: { operarioNombre, diaAsignado },
  });

  return NextResponse.json({ success: true, actualizadas: result.count });
}

// GET /api/conteo/ciclos/[id]/asignar — resumen de asignaciones
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireCan("manageConteo");
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;

  const grupos = await prisma.lineaConteo.groupBy({
    by: ["operarioNombre", "diaAsignado"],
    where: { cicloId: id, autoFill: false },
    _count: { id: true },
    orderBy: [{ diaAsignado: "asc" }, { operarioNombre: "asc" }],
  });

  return NextResponse.json({ success: true, data: grupos });
}
