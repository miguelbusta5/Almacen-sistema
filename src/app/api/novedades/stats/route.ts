import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

// GET /api/novedades/stats?dias=30
// Retorna métricas operativas: accuracy rate, pareto PLUs, distribución por tipo/causa/turno/zona
export async function GET(req: NextRequest) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;

  const sp = req.nextUrl.searchParams;
  const dias = Math.min(90, Math.max(7, parseInt(sp.get("dias") ?? "30") || 30));
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);

  const novedades = await prisma.novedad.findMany({
    where: { created_at: { gte: desde } },
    select: {
      id: true, estado: true, plu: true, posicion: true, fabricante: true,
      tipoNovedad: true, causaRaiz: true, turno: true, zonaBodega: true,
      asignadoA: true, resueltoAt: true, netsuiteAjust: true,
      costoIncidencia: true, fecha: true, created_at: true,
    },
  });

  const total = novedades.length;
  const pendientes = novedades.filter((n) => n.estado === "PENDIENTE").length;
  const enProceso = novedades.filter((n) => n.estado === "EN PROCESO").length;
  const resueltas = novedades.filter((n) => n.estado === "SOLUCIONADO").length;
  const sinAsignar = novedades.filter((n) => n.estado !== "SOLUCIONADO" && !n.asignadoA).length;
  const sinNetSuite = novedades.filter((n) => n.estado === "SOLUCIONADO" && !n.netsuiteAjust).length;

  // Tiempo promedio de resolución (días)
  const resueltas_con_fecha = novedades.filter((n) => n.resueltoAt && n.created_at);
  const tiempoPromResolucion = resueltas_con_fecha.length > 0
    ? resueltas_con_fecha.reduce((sum, n) => {
        const dias_resol = (new Date(n.resueltoAt!).getTime() - new Date(n.created_at!).getTime()) / 86_400_000;
        return sum + dias_resol;
      }, 0) / resueltas_con_fecha.length
    : null;

  // Pareto PLUs (top 10 por frecuencia)
  const byPlu: Record<string, number> = {};
  for (const n of novedades) byPlu[n.plu] = (byPlu[n.plu] ?? 0) + 1;
  const paretoPlu = Object.entries(byPlu)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([plu, count]) => ({ plu, count, pct: Math.round(count / total * 100) }));

  // Distribución por tipo
  const byTipo: Record<string, number> = {};
  for (const n of novedades) {
    const k = n.tipoNovedad ?? "SIN_CLASIFICAR";
    byTipo[k] = (byTipo[k] ?? 0) + 1;
  }

  // Distribución por causa raíz
  const byCausa: Record<string, number> = {};
  for (const n of novedades) {
    const k = n.causaRaiz ?? "SIN_CLASIFICAR";
    byCausa[k] = (byCausa[k] ?? 0) + 1;
  }

  // Distribución por turno
  const byTurno: Record<string, number> = {};
  for (const n of novedades) {
    const k = n.turno ?? "SIN_TURNO";
    byTurno[k] = (byTurno[k] ?? 0) + 1;
  }

  // Distribución por zona de bodega (heatmap data)
  const byZona: Record<string, number> = {};
  for (const n of novedades) {
    if (!n.zonaBodega) continue;
    byZona[n.zonaBodega] = (byZona[n.zonaBodega] ?? 0) + 1;
  }
  const topZonas = Object.entries(byZona)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([zona, count]) => ({ zona, count }));

  // Top fabricantes por impacto económico
  const byFab: Record<string, number> = {};
  const totalImpacto = novedades.reduce((s, n) => s + Math.abs(n.costoIncidencia ?? 0), 0);
  for (const n of novedades) {
    if (!n.fabricante) continue;
    byFab[n.fabricante] = (byFab[n.fabricante] ?? 0) + Math.abs(n.costoIncidencia ?? 0);
  }
  const topFabricantes = Object.entries(byFab)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([fab, costo]) => ({ fab, costo, pct: Math.round(costo / totalImpacto * 100) }));

  // Tasa de clasificación (% que tiene tipo + causa)
  const clasificadas = novedades.filter((n) => n.tipoNovedad && n.causaRaiz).length;
  const tasaClasificacion = total > 0 ? Math.round(clasificadas / total * 100) : 0;

  return NextResponse.json({
    success: true,
    dias,
    resumen: { total, pendientes, enProceso, resueltas, sinAsignar, sinNetSuite },
    tasaClasificacion,
    tiempoPromResolucion: tiempoPromResolucion ? Math.round(tiempoPromResolucion * 10) / 10 : null,
    impactoTotal: totalImpacto,
    paretoPlu,
    byTipo,
    byCausa,
    byTurno,
    topZonas,
    topFabricantes,
  });
}
