import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireCan } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import type { LayoutItem, StudioComponent } from "@/types/studio";

// GET /api/studio/dashboards/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;

  const { id } = await params;

  const dashboard = await prisma.studioDashboard.findUnique({
    where: { id },
    include: { fuentes: true },
  });

  if (!dashboard) {
    return NextResponse.json({ error: "Dashboard no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ dashboard });
}

// PUT /api/studio/dashboards/[id] — actualizar layout, componentes, fuentes, nombre
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireCan("manageStudio");
  if (actor instanceof NextResponse) return actor;

  const { id } = await params;

  let body: {
    nombre?: string;
    descripcion?: string;
    layout?: LayoutItem[];
    componentes?: StudioComponent[];
    estilos?: Record<string, unknown>;
    estado?: "BORRADOR" | "PUBLICADO";
    fuentes?: {
      id?: string;
      nombre: string;
      tipo?: string;
      urlSheets?: string;
      hojaActiva?: string;
      campos?: unknown[];
      camposFormulados?: unknown[];
      parametros?: unknown[];
      combinaciones?: unknown[];
    }[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const existing = await prisma.studioDashboard.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Dashboard no encontrado" }, { status: 404 });

  // Actualizar fuentes si vienen en el body
  if (body.fuentes) {
    // Upsert cada fuente
    for (const f of body.fuentes) {
      if (f.id) {
        await prisma.studioFuente.update({
          where: { id: f.id },
          data: {
            nombre: f.nombre,
            tipo: f.tipo ?? "sheets_csv",
            urlSheets: f.urlSheets ?? null,
            hojaActiva: f.hojaActiva ?? null,
            campos: (f.campos as object[]) ?? [],
            camposFormulados: (f.camposFormulados as object[]) ?? [],
            parametros: (f.parametros as object[]) ?? [],
            combinaciones: (f.combinaciones as object[]) ?? [],
            syncedAt: new Date(),
          },
        });
      } else {
        await prisma.studioFuente.create({
          data: {
            dashboardId: id,
            nombre: f.nombre,
            tipo: f.tipo ?? "sheets_csv",
            urlSheets: f.urlSheets ?? null,
            hojaActiva: f.hojaActiva ?? null,
            campos: (f.campos as object[]) ?? [],
            camposFormulados: (f.camposFormulados as object[]) ?? [],
            parametros: (f.parametros as object[]) ?? [],
            combinaciones: [],
            syncedAt: new Date(),
          },
        });
      }
    }
  }

  const updated = await prisma.studioDashboard.update({
    where: { id },
    data: {
      ...(body.nombre !== undefined && { nombre: body.nombre }),
      ...(body.descripcion !== undefined && { descripcion: body.descripcion }),
      ...(body.layout !== undefined && { layout: body.layout as object[] }),
      ...(body.componentes !== undefined && { componentes: body.componentes as object[] }),
      ...(body.estilos !== undefined && { estilos: body.estilos as object }),
      ...(body.estado !== undefined && { estado: body.estado }),
    },
    include: { fuentes: true },
  });

  return NextResponse.json({ dashboard: updated });
}

// DELETE /api/studio/dashboards/[id] — solo ADMIN
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireCan("delete");
  if (actor instanceof NextResponse) return actor;

  const { id } = await params;

  const existing = await prisma.studioDashboard.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Dashboard no encontrado" }, { status: 404 });

  await prisma.studioDashboard.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
