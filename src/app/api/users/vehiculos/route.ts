import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const vehiculoSchema = z.object({
  placa: z.string().min(3, "Placa requerida").max(20),
  tipo: z.string().min(2, "Tipo requerido").max(20),
  capacidadKg: z.coerce.number().int().positive().nullable().optional(),
  estado: z.enum(["ACTIVO", "MANTENIMIENTO", "INACTIVO"]).default("ACTIVO"),
});

async function requireAdmin() {
  const session = await auth();
  return session && (session.user as any)?.role === "ADMIN";
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const vehiculos = await prisma.vehiculo.findMany({
    select: {
      id: true,
      placa: true,
      tipo: true,
      capacidadKg: true,
      estado: true,
      transportistas: { select: { id: true, nombre: true, activo: true } },
    },
    orderBy: { placa: "asc" },
  });

  return NextResponse.json({ success: true, data: vehiculos });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = vehiculoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const data = parsed.data;
  try {
    const vehiculo = await prisma.vehiculo.create({
      data: {
        placa: data.placa.trim().toUpperCase(),
        tipo: data.tipo.trim().toUpperCase(),
        capacidadKg: data.capacidadKg ?? null,
        estado: data.estado,
      },
      select: { id: true, placa: true, tipo: true, capacidadKg: true, estado: true },
    });
    return NextResponse.json({ success: true, data: vehiculo }, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Ya existe un vehiculo con esa placa" }, { status: 400 });
    }
    throw error;
  }
}
