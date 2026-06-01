import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireCan } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET() {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  const rows = await prisma.operarioCiclo.findMany({ orderBy: { nombre: "asc" } });
  return NextResponse.json({ success: true, data: rows });
}

export async function POST(req: NextRequest) {
  const actor = await requireCan("manageConteo");
  if (actor instanceof NextResponse) return actor;
  const body = await req.json();
  const parsed = z.object({ nombre: z.string().min(1) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  const row = await prisma.operarioCiclo.create({ data: { nombre: parsed.data.nombre.trim() } });
  return NextResponse.json({ success: true, data: row }, { status: 201 });
}
