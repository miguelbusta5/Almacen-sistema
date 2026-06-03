import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// GET /api/notificaciones?unread=true
export async function GET(req: NextRequest) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;

  const soloNoLeidas = req.nextUrl.searchParams.get("unread") === "true";
  const rows = await prisma.notificacion.findMany({
    where: { userId: actor.id, ...(soloNoLeidas ? { leida: false } : {}) },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const totalNoLeidas = soloNoLeidas ? rows.length : await prisma.notificacion.count({ where: { userId: actor.id, leida: false } });
  return NextResponse.json({ success: true, data: rows, totalNoLeidas });
}

// POST /api/notificaciones — crear notificación interna (uso server-side)
const schema = z.object({
  userId: z.string(),
  titulo: z.string().max(255),
  descripcion: z.string().nullable().optional(),
  tipo: z.string().max(50),
  enlace: z.string().max(500).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const n = await prisma.notificacion.create({ data: { ...parsed.data, descripcion: parsed.data.descripcion ?? null, enlace: parsed.data.enlace ?? null } });
  return NextResponse.json({ success: true, data: n }, { status: 201 });
}
