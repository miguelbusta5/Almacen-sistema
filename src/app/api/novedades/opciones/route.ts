import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

const MAX_RESULTS = 500;

// GET /api/novedades/opciones — PLU y posiciones distintos ya usados en
// novedades, para el autocompletado al crear una nueva. Antes se
// derivaban del arreglo completo (pageSize=500) cargado en el cliente;
// `idx_plu_posicion_fecha` soporta el distinct sin escanear todo el
// histórico fila por fila.
export async function GET() {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;

  const [plus, posiciones] = await Promise.all([
    prisma.novedad.findMany({ select: { plu: true }, distinct: ["plu"], orderBy: { plu: "asc" }, take: MAX_RESULTS }),
    prisma.novedad.findMany({ select: { posicion: true }, distinct: ["posicion"], orderBy: { posicion: "asc" }, take: MAX_RESULTS }),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      plus: plus.map((p) => p.plu),
      posiciones: posiciones.map((p) => p.posicion),
    },
  });
}
