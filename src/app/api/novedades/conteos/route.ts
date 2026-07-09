import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

// GET /api/novedades/conteos — totales por estado para los chips de
// filtro, independientes de la paginación de la lista. Antes se
// calculaban filtrando el arreglo completo (pageSize=500) cargado en el
// cliente.
export async function GET() {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;

  const porEstado = await prisma.novedad.groupBy({ by: ["estado"], _count: { estado: true } });
  const count = (estado: string) => porEstado.find((g) => g.estado === estado)?._count.estado ?? 0;
  const total = porEstado.reduce((sum, g) => sum + g._count.estado, 0);

  return NextResponse.json({
    success: true,
    data: {
      "": total,
      PENDIENTE: count("PENDIENTE"),
      "EN PROCESO": count("EN PROCESO"),
      SOLUCIONADO: count("SOLUCIONADO"),
    },
  });
}
