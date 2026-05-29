import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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