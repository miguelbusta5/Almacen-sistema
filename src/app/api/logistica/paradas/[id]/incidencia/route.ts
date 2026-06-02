import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { put } from "@vercel/blob";
import { INCIDENCIA_REQUIERE_FOTO } from "@/lib/logistica";

const TIPOS_VALIDOS = ["INC-01","INC-02","INC-03","INC-04","INC-05","INC-06","INC-07","INC-08"] as const;

// POST /api/logistica/paradas/[id]/incidencia — reportar incidencia de ruta
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  const { id: paradaId } = await params;

  const parada = await prisma.parada.findUnique({ where: { id: paradaId }, include: { ruta: true } });
  if (!parada) return NextResponse.json({ error: "Parada no encontrada" }, { status: 404 });

  // Resolver transportistaId desde sesión
  const transportista = await prisma.transportista.findUnique({ where: { userId: actor.id } });

  const contentType = req.headers.get("content-type") ?? "";

  let tipo: string, descripcion: string | null = null, fotoUrl: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    tipo = String(form.get("tipo") ?? "");
    descripcion = form.get("descripcion") ? String(form.get("descripcion")) : null;
    const foto = form.get("foto") as File | null;
    if (foto) {
      const blob = await put(`incidencias/${Date.now()}-${actor.id.slice(-4)}.${foto.name.split(".").pop() ?? "jpg"}`, foto, { access: "public" });
      fotoUrl = blob.url;
    }
  } else {
    const body = await req.json();
    tipo = body.tipo;
    descripcion = body.descripcion ?? null;
  }

  if (!TIPOS_VALIDOS.includes(tipo as typeof TIPOS_VALIDOS[number])) {
    return NextResponse.json({ error: "Tipo de incidencia inválido" }, { status: 400 });
  }

  // Validar foto obligatoria para ciertos tipos
  if (INCIDENCIA_REQUIERE_FOTO.includes(tipo as typeof TIPOS_VALIDOS[number]) && !fotoUrl) {
    return NextResponse.json({ error: `Este tipo de incidencia (${tipo}) requiere foto` }, { status: 400 });
  }

  const incidencia = await prisma.incidenciaRuta.create({
    data: {
      paradaId,
      rutaId: parada.rutaId,
      transportistaId: transportista?.id ?? actor.id,
      tipo,
      descripcion,
      fotoUrl,
    },
  });

  await prisma.activityLog.create({
    data: { userId: actor.id, action: "CREATE", module: "logistica", recordId: paradaId, details: `Incidencia: ${tipo}` },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: incidencia }, { status: 201 });
}

// GET /api/logistica/paradas/[id]/incidencia
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  const { id: paradaId } = await params;
  const rows = await prisma.incidenciaRuta.findMany({ where: { paradaId }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ success: true, data: rows });
}
