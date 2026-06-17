import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { calcularDuracionMinutos, puedeGestionarExportaciones, todayBogota } from "@/lib/exportaciones";

export async function GET(req: NextRequest) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  if (!puedeGestionarExportaciones(actor.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const fechaParam = searchParams.get("fecha");
  const fecha = fechaParam ? new Date(`${fechaParam}T00:00:00.000Z`) : todayBogota();

  const registros = await prisma.etiquetadoExportacion.findMany({
    where: { fecha, deletedAt: null },
    select: {
      plu: true,
      unidadEmpaque: true,
      horaInicio: true,
      horaFinalizacion: true,
      creadoPorId: true,
      creadoPor: { select: { name: true } },
    },
  });

  const byUser = new Map<string, {
    nombre: string;
    cajas: number;
    plusSet: Set<string>;
    duracionTotal: number;
    finalizadas: number;
    totalUnidades: number;
  }>();

  for (const r of registros) {
    if (!byUser.has(r.creadoPorId)) {
      byUser.set(r.creadoPorId, {
        nombre: r.creadoPor.name ?? "Usuario",
        cajas: 0,
        plusSet: new Set(),
        duracionTotal: 0,
        finalizadas: 0,
        totalUnidades: 0,
      });
    }
    const u = byUser.get(r.creadoPorId)!;
    u.cajas++;
    u.plusSet.add(r.plu);
    u.totalUnidades += r.unidadEmpaque;
    if (r.horaFinalizacion) {
      u.finalizadas++;
      const min = calcularDuracionMinutos(r.horaInicio, r.horaFinalizacion);
      if (min) u.duracionTotal += min;
    }
  }

  const data = Array.from(byUser.entries())
    .map(([id, u]) => ({
      id,
      nombre: u.nombre,
      cajas: u.cajas,
      plusDistintos: u.plusSet.size,
      totalUnidades: u.totalUnidades,
      finalizadas: u.finalizadas,
      duracionTotalMin: u.duracionTotal,
      promedioPorCajaMin:
        u.finalizadas > 0
          ? Math.round((u.duracionTotal / u.finalizadas) * 10) / 10
          : null,
    }))
    .sort((a, b) => b.cajas - a.cajas);

  return NextResponse.json({ success: true, data });
}
