import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const transportistas = await prisma.transportista.findMany({
    where: { activo: true, userId: null, vehiculoId: { not: null } },
    select: {
      id: true,
      nombre: true,
      telefono: true,
      vehiculo: { select: { placa: true, tipo: true, estado: true } },
    },
    orderBy: { nombre: "asc" },
  });

  return NextResponse.json({ success: true, data: transportistas });
}
