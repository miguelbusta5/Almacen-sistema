import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { mapExportacion } from "../../route";
import { puedeUsarExportaciones } from "@/lib/exportaciones";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  if (!puedeUsarExportaciones(actor.role)) {
    return NextResponse.json({ error: "Sin acceso a Exportaciones" }, { status: 403 });
  }

  const { id } = await params;

  const record = await prisma.etiquetadoExportacion.findUnique({
    where: { id },
    select: { creadoPorId: true, horaFinalizacion: true, deletedAt: true },
  });

  if (!record || record.deletedAt) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  if (record.creadoPorId !== actor.id) {
    return NextResponse.json({ error: "Solo puedes finalizar tus propios registros" }, { status: 403 });
  }
  if (record.horaFinalizacion) {
    return NextResponse.json({ error: "El registro ya está finalizado" }, { status: 409 });
  }

  const updated = await prisma.etiquetadoExportacion.update({
    where: { id },
    data: { horaFinalizacion: new Date(), actualizadoPorId: actor.id },
    include: {
      creadoPor: { select: { name: true } },
      actualizadoPor: { select: { name: true } },
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: "UPDATE",
      module: "exportaciones",
      recordId: id,
      details: "Rotulación finalizada manualmente",
    },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: mapExportacion(updated) });
}
