import { NextRequest, NextResponse } from "next/server";
import { requireCan, requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await requireRole(["ADMIN", "GERENTE", "SUPERVISOR_TRANSPORTE"]);
  if (actor instanceof NextResponse) return actor;

  const { id } = await params;

  const inspeccion = await prisma.inspeccionPreoperacional.findUnique({
    where: { id },
    include: {
      conductor:    { select: { id: true, nombre: true, telefono: true } },
      vehiculo:     { select: { id: true, placa: true, tipo: true } },
      realizadoPor: { select: { id: true, name: true } },
      items:        { orderBy: [{ categoria: "asc" }, { item: "asc" }] },
    },
  });

  if (!inspeccion) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  return NextResponse.json({
    success: true,
    data: {
      id:            inspeccion.id,
      fecha:         inspeccion.fecha instanceof Date
                       ? inspeccion.fecha.toISOString().slice(0, 10)
                       : inspeccion.fecha,
      kilometraje:   inspeccion.kilometraje  ?? null,
      observaciones: inspeccion.observaciones ?? null,
      estado:        inspeccion.estado,
      conductor:     inspeccion.conductor,
      vehiculo:      inspeccion.vehiculo,
      realizadoPor:  inspeccion.realizadoPor,
      items: inspeccion.items.map((i) => ({
        id:          i.id,
        categoria:   i.categoria,
        item:        i.item,
        resultado:   i.resultado,
        esCritico:   i.esCritico,
        fotoUrl:     i.fotoUrl     ?? null,
        observacion: i.observacion ?? null,
      })),
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await requireCan("delete");
  if (actor instanceof NextResponse) return actor;

  const { id } = await params;

  await prisma.inspeccionPreoperacional.delete({ where: { id } }).catch(() => {});

  prisma.activityLog.create({
    data: { userId: actor.id, action: "DELETE", module: "preoperacional", recordId: id },
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
