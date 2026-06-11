import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const actor = await requireRole(["ADMIN", "GERENTE"]);
  if (actor instanceof NextResponse) return actor;

  const [totalNov, pendNov, solNov, totalTrans, pendTrans, despTrans] = await Promise.all([
    prisma.novedad.count(),
    prisma.novedad.count({ where: { estado: "PENDIENTE" } }),
    prisma.novedad.count({ where: { estado: "SOLUCIONADO" } }),
    prisma.transporteGuardado.count(),
    prisma.transporteGuardado.count({ where: { estado: "PENDIENTE DESPACHO" } }),
    prisma.transporteGuardado.count({ where: { estado: "DESPACHADO" } }),
  ]);

  return NextResponse.json({
    novedades: { total: totalNov, pendientes: pendNov, solucionados: solNov },
    transporte: { total: totalTrans, pendientes: pendTrans, despachados: despTrans, alertas: 0 },
  });
}
