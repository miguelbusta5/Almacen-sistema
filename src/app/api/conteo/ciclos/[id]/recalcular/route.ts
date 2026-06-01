import { NextRequest, NextResponse } from "next/server";
import { requireCan } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { esAutoFill } from "@/lib/conteo";

// POST /api/conteo/ciclos/[id]/recalcular
// Recalcula auto_fill según la regla correcta (Recolección+RETIRO=contar, resto=auto)
// sin borrar datos de conteo ya ingresados.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireCan("manageConteo");
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;

  const lineas = await prisma.lineaConteo.findMany({
    where: { cicloId: id },
    select: { id: true, tipoPasillo: true, autoFill: true, estado: true, teorico: true },
  });

  let aAutoFill = 0, aFisica = 0;

  for (const l of lineas) {
    const debeAutoFill = esAutoFill(l.tipoPasillo);

    if (debeAutoFill && !l.autoFill) {
      // Era física → pasa a auto-fill OK
      await prisma.lineaConteo.update({
        where: { id: l.id },
        data: {
          autoFill: true,
          estado: "OK",
          cantidadContada: l.teorico,
          diferenciaFinal: 0,
        },
      });
      aAutoFill++;
    } else if (!debeAutoFill && l.autoFill) {
      // Era auto-fill → pasa a física pendiente (solo si no fue contada manualmente)
      const yaContada = l.estado === "CONTADO" || l.estado === "EN_RECONTEO" || l.estado === "NOVEDAD";
      await prisma.lineaConteo.update({
        where: { id: l.id },
        data: {
          autoFill: false,
          estado: yaContada ? l.estado : "PENDIENTE",
          cantidadContada: yaContada ? undefined : null,
          diferenciaFinal: yaContada ? undefined : null,
        },
      });
      aFisica++;
    }
  }

  return NextResponse.json({ success: true, pasaronAAutoFill: aAutoFill, pasaronAFisica: aFisica });
}
