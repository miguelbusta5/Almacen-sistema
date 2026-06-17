import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { canSeeModule } from "@/lib/modulePermissions";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  if (!canSeeModule(actor.role, "indicadores")) {
    return NextResponse.json({ error: "No tienes permisos para ver indicadores" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const proceso = sp.get("proceso")?.trim();
  const periodo = sp.get("periodo")?.trim();
  const fuente = sp.get("fuente")?.trim();
  const q = sp.get("q")?.trim();

  const where = {
    ...(proceso ? { proceso } : {}),
    ...(periodo ? { periodo } : {}),
    ...(fuente ? { fuente: { nombre: fuente } } : {}),
    ...(q ? {
      OR: [
        { proceso: { contains: q, mode: "insensitive" as const } },
        { indicador: { contains: q, mode: "insensitive" as const } },
        { periodo: { contains: q, mode: "insensitive" as const } },
      ],
    } : {}),
  };

  const [items, fuentes, procesos, periodos, byEstado] = await Promise.all([
    prisma.indicadorCedi.findMany({
      where,
      orderBy: [{ syncedAt: "desc" }, { proceso: "asc" }, { indicador: "asc" }],
      take: 500,
      include: { fuente: { select: { nombre: true, lastSyncAt: true, lastSyncStatus: true, lastSyncError: true, rango: true } } },
    }),
    prisma.indicadorFuente.findMany({ orderBy: { nombre: "asc" } }),
    prisma.indicadorCedi.findMany({ distinct: ["proceso"], select: { proceso: true }, orderBy: { proceso: "asc" } }),
    prisma.indicadorCedi.findMany({ distinct: ["periodo"], select: { periodo: true }, orderBy: { periodo: "desc" }, take: 24 }),
    prisma.indicadorCedi.groupBy({ by: ["estado"], _count: { _all: true }, where }),
  ]);

  const total = items.length;
  const promedioCumplimiento = items.length
    ? items.reduce((acc, item) => {
      const valor = Number(item.valor);
      const meta = item.meta === null ? null : Number(item.meta);
      if (!meta) return acc;
      return acc + Math.min(1.5, valor / meta);
    }, 0) / Math.max(1, items.filter((item) => item.meta !== null && Number(item.meta) !== 0).length)
    : 0;

  return NextResponse.json({
    success: true,
    data: items.map((item) => ({
      id: item.id,
      proceso: item.proceso,
      indicador: item.indicador,
      periodo: item.periodo,
      valor: Number(item.valor),
      meta: item.meta === null ? null : Number(item.meta),
      unidad: item.unidad,
      estado: item.estado,
      syncedAt: item.syncedAt,
      fuente: item.fuente,
    })),
    meta: {
      total,
      promedioCumplimiento,
      fuentes,
      procesos: procesos.map((p) => p.proceso),
      periodos: periodos.map((p) => p.periodo),
      estados: byEstado.map((e) => ({ estado: e.estado, total: e._count._all })),
    },
  });
}
