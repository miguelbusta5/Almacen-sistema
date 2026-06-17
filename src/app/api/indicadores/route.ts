import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { canSeeModule } from "@/lib/modulePermissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  if (!canSeeModule(actor.role, "indicadores")) {
    return NextResponse.json({ error: "No tienes permisos para ver indicadores" }, { status: 403 });
  }

  const [fuente, resumenMes, tipoOrden, plus] = await Promise.all([
    prisma.indicadorFuente.findFirst({ orderBy: { updatedAt: "desc" } }),
    prisma.indicadorResumenMes.findMany({ orderBy: [{ anio: "asc" }, { mes: "asc" }] }),
    prisma.indicadorTipoOrden.findMany({ orderBy: [{ anio: "asc" }, { ordenes: "desc" }] }),
    prisma.indicadorPLU.findMany({ orderBy: [{ anio: "asc" }, { enviados: "desc" }] }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      fuente: fuente
        ? { lastSyncAt: fuente.lastSyncAt, lastSyncStatus: fuente.lastSyncStatus, lastSyncError: fuente.lastSyncError }
        : null,
      resumenMes: resumenMes.map((r) => ({
        anio: r.anio, mes: r.mes, mesNombre: r.mesNombre,
        grupo: r.grupo, tipoMov: r.tipoMov,
        ordenes: r.ordenes, unidades: r.unidades, lineas: r.lineas,
      })),
      tipoOrden: tipoOrden.map((r) => ({
        anio: r.anio, tipoOrden: r.tipoOrden, grupo: r.grupo,
        ordenes: r.ordenes, unidades: r.unidades,
      })),
      plus: plus.map((r) => ({
        plu: r.plu, descripcion: r.descripcion, grupo: r.grupo,
        anio: r.anio, enviados: r.enviados, unidades: r.unidades,
      })),
    },
  });
}
