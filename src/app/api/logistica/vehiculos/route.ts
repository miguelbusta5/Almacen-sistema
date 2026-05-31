import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireCan } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  placa: z.string().min(1).max(20),
  tipo: z.enum(["CAMION", "FURGON", "VAN", "MOTO"]),
  capacidadKg: z.coerce.number().int().positive().nullable().optional(),
  estado: z.enum(["ACTIVO", "MANTENIMIENTO", "INACTIVO"]).default("ACTIVO"),
});

export async function GET() {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  const rows = await prisma.vehiculo.findMany({ orderBy: { placa: "asc" } });
  return NextResponse.json({ success: true, data: rows });
}

export async function POST(req: NextRequest) {
  const actor = await requireCan("manageLogistica");
  if (actor instanceof NextResponse) return actor;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  try {
    const row = await prisma.vehiculo.create({ data: { ...parsed.data, capacidadKg: parsed.data.capacidadKg ?? null } });
    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "Placa ya registrada" }, { status: 400 });
    return NextResponse.json({ error: "Error al crear" }, { status: 500 });
  }
}
