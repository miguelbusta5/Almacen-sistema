import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireCan } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

// GET /api/studio/dashboards — lista dashboards visibles para el usuario
export async function GET() {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;

  const dashboards = await prisma.studioDashboard.findMany({
    orderBy: { updatedAt: "desc" },
    include: { fuentes: true },
  });

  return NextResponse.json({ dashboards });
}

// POST /api/studio/dashboards — crear nuevo dashboard
export async function POST(req: NextRequest) {
  const actor = await requireCan("manageStudio");
  if (actor instanceof NextResponse) return actor;

  let body: { nombre?: string; descripcion?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { nombre, descripcion } = body;
  if (!nombre?.trim()) {
    return NextResponse.json({ error: "El nombre del dashboard es requerido" }, { status: 400 });
  }

  const dashboard = await prisma.studioDashboard.create({
    data: {
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() ?? null,
      layout: [],
      componentes: [],
      estilos: {},
      estado: "BORRADOR",
      createdById: actor.id,
    },
    include: { fuentes: true },
  });

  return NextResponse.json({ dashboard }, { status: 201 });
}
