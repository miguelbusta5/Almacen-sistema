import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireCan } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  nombre: z.string().min(1).max(255),
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notas: z.string().nullable().optional(),
});

// GET /api/conteo/ciclos — lista todos los ciclos con KPIs básicos
export async function GET() {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;

  const ciclos = await prisma.cicloConteo.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { lineas: true } },
    },
  });

  // KPIs por ciclo
  const data = await Promise.all(
    ciclos.map(async (c) => {
      const counts = await prisma.lineaConteo.groupBy({
        by: ["estado"],
        where: { cicloId: c.id },
        _count: { estado: true },
      });
      const kpi = Object.fromEntries(counts.map((r) => [r.estado, r._count.estado]));
      const autoFill = await prisma.lineaConteo.count({ where: { cicloId: c.id, autoFill: true } });
      return {
        id: c.id,
        nombre: c.nombre,
        fechaInicio: c.fechaInicio.toISOString().slice(0, 10),
        estado: c.estado,
        totalLineas: c.totalLineas,
        notas: c.notas,
        createdAt: c.createdAt.toISOString(),
        pendientes: kpi["PENDIENTE"] ?? 0,
        contados: kpi["CONTADO"] ?? 0,
        enReconteo: kpi["EN_RECONTEO"] ?? 0,
        ok: kpi["OK"] ?? 0,
        novedades: kpi["NOVEDAD"] ?? 0,
        autoFill,
      };
    })
  );

  return NextResponse.json({ success: true, data });
}

// POST /api/conteo/ciclos — crear nuevo ciclo
export async function POST(req: NextRequest) {
  const actor = await requireCan("manageConteo");
  if (actor instanceof NextResponse) return actor;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const ciclo = await prisma.cicloConteo.create({
    data: {
      nombre: parsed.data.nombre,
      fechaInicio: new Date(parsed.data.fechaInicio + "T00:00:00"),
      notas: parsed.data.notas ?? null,
      creadoPor: actor.id,
    },
  });

  await prisma.activityLog.create({
    data: { userId: actor.id, action: "CREATE", module: "conteo", recordId: ciclo.id, details: parsed.data.nombre },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: { ...ciclo, fechaInicio: ciclo.fechaInicio.toISOString().slice(0, 10) } }, { status: 201 });
}
