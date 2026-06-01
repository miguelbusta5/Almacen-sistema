import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireCan } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  estado: z.enum(["PLANIFICADO", "EN_PROGRESO", "EN_RECONTEO", "CERRADO"]).optional(),
  notas: z.string().nullable().optional(),
});

// GET /api/conteo/ciclos/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;

  const ciclo = await prisma.cicloConteo.findUnique({ where: { id } });
  if (!ciclo) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const counts = await prisma.lineaConteo.groupBy({
    by: ["estado"],
    where: { cicloId: id },
    _count: { estado: true },
  });
  const kpi = Object.fromEntries(counts.map((r) => [r.estado, r._count.estado]));
  const autoFill = await prisma.lineaConteo.count({ where: { cicloId: id, autoFill: true } });

  return NextResponse.json({
    success: true,
    data: {
      id: ciclo.id, nombre: ciclo.nombre,
      fechaInicio: ciclo.fechaInicio.toISOString().slice(0, 10),
      estado: ciclo.estado, totalLineas: ciclo.totalLineas, notas: ciclo.notas,
      createdAt: ciclo.createdAt.toISOString(),
      pendientes: kpi["PENDIENTE"] ?? 0, contados: kpi["CONTADO"] ?? 0,
      enReconteo: kpi["EN_RECONTEO"] ?? 0, ok: kpi["OK"] ?? 0,
      novedades: kpi["NOVEDAD"] ?? 0, autoFill,
    },
  });
}

// PUT /api/conteo/ciclos/[id] — cambiar estado o notas
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireCan("manageConteo");
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const ciclo = await prisma.cicloConteo.update({ where: { id }, data: parsed.data });
  await prisma.activityLog.create({
    data: { userId: actor.id, action: "UPDATE", module: "conteo", recordId: id, details: parsed.data.estado ?? "actualizado" },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: { ...ciclo, fechaInicio: ciclo.fechaInicio.toISOString().slice(0, 10) } });
}

// DELETE /api/conteo/ciclos/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireCan("delete");
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;
  await prisma.cicloConteo.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
