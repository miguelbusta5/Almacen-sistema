import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { normalizePlu, productoToClient } from "@/lib/productosMaestro";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ plu: string }> }
) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;

  const { plu } = await params;
  const normalized = normalizePlu(decodeURIComponent(plu));
  if (!normalized) return NextResponse.json({ error: "PLU requerido" }, { status: 400 });

  const producto = await prisma.productoMaestro.findUnique({
    where: { plu: normalized },
    select: { plu: true, descripcion: true, fabricante: true, precio: true, marca: true },
  });
  if (!producto) return NextResponse.json({ error: "PLU no encontrado en maestro" }, { status: 404 });

  return NextResponse.json({ success: true, data: productoToClient(producto) });
}
