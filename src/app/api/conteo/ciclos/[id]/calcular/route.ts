import { NextRequest, NextResponse } from "next/server";
import { requireCan } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

// POST /api/conteo/ciclos/[id]/calcular
// Calcula diferencias de las líneas CONTADAS y las envía a EN_RECONTEO si hay diferencia
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireCan("manageConteo");
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;

  // Líneas que ya tienen cantidad contada pero aún están en CONTADO
  const lineasContadas = await prisma.lineaConteo.findMany({
    where: { cicloId: id, estado: "CONTADO", autoFill: false },
    select: { id: true, teorico: true, cantidadContada: true },
  });

  let ok = 0, reconteo = 0;

  for (const linea of lineasContadas) {
    const contada = Number(linea.cantidadContada ?? 0);
    const teorico = Number(linea.teorico);
    const diferencia = contada - teorico;

    if (diferencia === 0) {
      await prisma.lineaConteo.update({ where: { id: linea.id }, data: { estado: "OK", diferenciaFinal: 0 } });
      ok++;
    } else {
      await prisma.lineaConteo.update({ where: { id: linea.id }, data: { estado: "EN_RECONTEO" } });
      reconteo++;
    }
  }

  // Si hay líneas en reconteo, el ciclo pasa a EN_RECONTEO
  if (reconteo > 0) {
    await prisma.cicloConteo.update({ where: { id }, data: { estado: "EN_RECONTEO" } });
  }

  await prisma.activityLog.create({
    data: { userId: actor.id, action: "UPDATE", module: "conteo", recordId: id, details: `Calculadas ${lineasContadas.length} líneas: ${ok} OK, ${reconteo} en reconteo` },
  }).catch(() => {});

  return NextResponse.json({ success: true, ok, enReconteo: reconteo });
}
