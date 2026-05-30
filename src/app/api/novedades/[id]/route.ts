import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  plu: z.string().min(1).optional(),
  posicion: z.string().min(1).optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  estado: z.enum(["PENDIENTE", "EN PROCESO", "SOLUCIONADO"]).optional(),
  descripcion: z.string().nullable().optional(),
  cantidad: z.coerce.number().int().optional(),
  fabricante: z.string().nullable().optional(),
  costoUnitario: z.coerce.number().int().nullable().optional(),
});

// PUT /api/novedades/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  // Recalcular impacto si se envió costo unitario (impacto = costo × cantidad).
  // Si no se envía cantidad en el body, usar la existente.
  let costoIncidencia: number | undefined;
  if (d.costoUnitario != null) {
    let cant = d.cantidad;
    if (cant === undefined) {
      const actual = await prisma.novedad.findUnique({ where: { id: numId }, select: { cantidad: true } });
      cant = actual?.cantidad ?? 0;
    }
    costoIncidencia = d.costoUnitario * cant;
  }

  await prisma.novedad.update({
    where: { id: numId },
    data: {
      ...(d.plu !== undefined && { plu: d.plu }),
      ...(d.posicion !== undefined && { posicion: d.posicion }),
      ...(d.fecha !== undefined && { fecha: new Date(d.fecha + "T00:00:00") }),
      ...(d.estado !== undefined && { estado: d.estado }),
      ...(d.descripcion !== undefined && { descripcion: d.descripcion }),
      ...(d.cantidad !== undefined && { cantidad: d.cantidad }),
      ...(d.fabricante !== undefined && { fabricante: d.fabricante }),
      ...(d.costoUnitario !== undefined && { costoUnitario: d.costoUnitario }),
      ...(costoIncidencia !== undefined && { costoIncidencia }),
      updated_at: new Date(),
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: (session.user as { id: string }).id,
      action: "UPDATE",
      module: "muebles",
      recordId: id,
      details: d.estado ? `Estado: ${d.estado}` : "Actualización",
    },
  }).catch(() => {});

  return NextResponse.json({ success: true });
}

// DELETE /api/novedades/[id] — solo ADMIN
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await requireRole(["ADMIN"]);
  if (actor instanceof NextResponse) return actor;

  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  await prisma.novedad.delete({ where: { id: numId } }).catch(() => {});

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: "DELETE",
      module: "muebles",
      recordId: id,
    },
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
