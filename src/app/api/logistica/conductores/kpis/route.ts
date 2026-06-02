import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

// GET /api/logistica/conductores/kpis?dias=30
// KPIs de productividad por conductor: tasa entrega, tiempo prom, incidencias
export async function GET(req: NextRequest) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;

  const dias = parseInt(req.nextUrl.searchParams.get("dias") ?? "30") || 30;
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);

  const transportistas = await prisma.transportista.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, telefono: true, vehiculo: { select: { placa: true, tipo: true } } },
  });

  const kpis = await Promise.all(
    transportistas.map(async (t) => {
      // Rutas del conductor en el período
      const rutas = await prisma.ruta.findMany({
        where: { transportistaId: t.id, createdAt: { gte: desde } },
        include: { paradas: { select: { estado: true, entregadoAt: true, createdAt: true } } },
      });

      const totalParadas = rutas.reduce((s, r) => s + r.paradas.length, 0);
      const entregadas = rutas.reduce((s, r) => s + r.paradas.filter((p) => p.estado === "ENTREGADO").length, 0);
      const fallidas = rutas.reduce((s, r) => s + r.paradas.filter((p) => p.estado === "NO_ENTREGADO").length, 0);

      // Tiempo promedio por parada (en minutos)
      const tiempos: number[] = [];
      for (const r of rutas) {
        const paradConTiempo = r.paradas.filter((p) => p.entregadoAt && p.createdAt);
        for (const p of paradConTiempo) {
          tiempos.push((new Date(p.entregadoAt!).getTime() - new Date(p.createdAt).getTime()) / 60000);
        }
      }
      const tiempoPromedio = tiempos.length > 0
        ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length)
        : null;

      // Incidencias del período
      const incidencias = await prisma.incidenciaRuta.findMany({
        where: { transportistaId: t.id, createdAt: { gte: desde } },
        select: { tipo: true },
      });

      const incidenciasPorTipo: Record<string, number> = {};
      for (const inc of incidencias) {
        incidenciasPorTipo[inc.tipo] = (incidenciasPorTipo[inc.tipo] ?? 0) + 1;
      }

      const tasaEntrega = totalParadas > 0 ? Math.round(entregadas / totalParadas * 100) : null;

      return {
        transportistaId: t.id,
        nombre: t.nombre,
        telefono: t.telefono,
        vehiculo: t.vehiculo,
        periodo: { dias, desde: desde.toISOString() },
        rutas: rutas.length,
        totalParadas,
        entregadas,
        fallidas,
        tasaEntrega,
        tiempoPromedio,
        incidencias: incidencias.length,
        incidenciasPorTipo,
      };
    })
  );

  // Ordenar por tasa de entrega descendente
  const sorted = kpis
    .filter((k) => k.rutas > 0)
    .sort((a, b) => (b.tasaEntrega ?? 0) - (a.tasaEntrega ?? 0));

  return NextResponse.json({ success: true, data: sorted, periodo: { dias } });
}
