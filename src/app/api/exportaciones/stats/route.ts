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
  const parseDay = (value: string | null): Date | null => {
    if (!value) return null;
    const d = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  // Rango acumulado: `desde`/`hasta`. Compatibilidad: `fecha` = un solo día.
  const fechaParam = searchParams.get("fecha");
  const today = todayBogota();
  let desde = parseDay(searchParams.get("desde")) ?? parseDay(fechaParam) ?? today;
  let hasta = parseDay(searchParams.get("hasta")) ?? parseDay(fechaParam) ?? today;
  if (desde.getTime() > hasta.getTime()) [desde, hasta] = [hasta, desde];

  const registros = await prisma.etiquetadoExportacion.findMany({
    where: { fecha: { gte: desde, lte: hasta }, deletedAt: null },
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
    u.totalUnidades += Math.round(r.unidadEmpaque);
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
      totalUnidades: Math.round(u.totalUnidades),
      finalizadas: u.finalizadas,
      duracionTotalMin: u.duracionTotal,
      promedioPorCajaMin:
        u.finalizadas > 0
          ? Math.round((u.duracionTotal / u.finalizadas) * 10) / 10
          : null,
    }))
    .sort((a, b) => b.cajas - a.cajas);

  const rango = {
    desde: desde.toISOString().slice(0, 10),
    hasta: hasta.toISOString().slice(0, 10),
  };

  return NextResponse.json({ success: true, data, rango });
}
