import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

// PUT /api/notificaciones/leer — marca todas como leídas
export async function PUT() {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  await prisma.notificacion.updateMany({ where: { userId: actor.id, leida: false }, data: { leida: true } });
  return NextResponse.json({ success: true });
}
