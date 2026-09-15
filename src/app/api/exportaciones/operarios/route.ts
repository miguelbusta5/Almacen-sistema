import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { puedeGestionarExportaciones } from "@/lib/exportaciones";

// Operarios distintos que han registrado etiquetado, para el filtro de la lista.
export async function GET() {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  if (!puedeGestionarExportaciones(actor.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const rows = await prisma.etiquetadoExportacion.findMany({
    where: { deletedAt: null },
    distinct: ["creadoPorId"],
    select: { creadoPorId: true, creadoPor: { select: { name: true } } },
  });

  const data = rows
    .map((r) => ({ id: r.creadoPorId, nombre: r.creadoPor?.name ?? "Usuario" }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return NextResponse.json({ success: true, data });
}
