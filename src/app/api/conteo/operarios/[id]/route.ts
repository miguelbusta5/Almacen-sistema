import { NextRequest, NextResponse } from "next/server";
import { requireCan } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireCan("manageConteo");
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;
  const body = await req.json();
  const parsed = z.object({ nombre: z.string().min(1).optional(), activo: z.boolean().optional() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const row = await prisma.operarioCiclo.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ success: true, data: row });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireCan("manageConteo");
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;
  await prisma.operarioCiclo.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
