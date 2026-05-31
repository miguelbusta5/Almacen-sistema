import { NextRequest, NextResponse } from "next/server";
import { requireCan } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  placa: z.string().min(1).max(20).optional(),
  tipo: z.enum(["CAMION", "FURGON", "VAN", "MOTO"]).optional(),
  capacidadKg: z.coerce.number().int().positive().nullable().optional(),
  estado: z.enum(["ACTIVO", "MANTENIMIENTO", "INACTIVO"]).optional(),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireCan("manageLogistica");
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  try {
    const row = await prisma.vehiculo.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ success: true, data: row });
  } catch { return NextResponse.json({ error: "No encontrado" }, { status: 404 }); }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireCan("delete");
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;
  try {
    await prisma.vehiculo.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: "No encontrado o tiene transportistas asignados" }, { status: 409 }); }
}
