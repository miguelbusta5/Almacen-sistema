import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { mapExportacion } from "../route";
import { normalizePlu, puedeGestionarExportaciones, validarRegueroExportacion } from "@/lib/exportaciones";

const patchSchema = z.object({
  numeroCaja:      z.string().min(1).max(100).optional(),
  plu:             z.string().min(1).max(100).optional(),
  unidadEmpaque:   z.number().int().min(1).optional(),
  horaInicio:      z.string().datetime().optional(),
  horaFinalizacion: z.string().datetime().optional().nullable(),
  motivoCorreccion: z.string().min(5).optional(),
  hayReguero:      z.boolean().optional(),
  cantidadReguero: z.number().int().min(1).optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  if (!puedeGestionarExportaciones(actor.role)) {
    return NextResponse.json({ error: "Solo gestion puede editar Exportaciones" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;
  const cambiaHoras = d.horaInicio !== undefined || d.horaFinalizacion !== undefined;
  if (cambiaHoras && !d.motivoCorreccion?.trim()) {
    return NextResponse.json({ error: "Motivo de correccion obligatorio para modificar horas" }, { status: 400 });
  }

  const current = await prisma.etiquetadoExportacion.findUnique({ where: { id }, select: { deletedAt: true } });
  if (!current || current.deletedAt) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (d.hayReguero !== undefined || d.cantidadReguero !== undefined) {
    const validReguero = validarRegueroExportacion({
      hayReguero: d.hayReguero,
      cantidadReguero: d.cantidadReguero,
    });
    if (validReguero) return NextResponse.json({ error: validReguero }, { status: 400 });
  }

  const data: any = {
    actualizadoPorId: actor.id,
    ...(d.numeroCaja !== undefined && { numeroCaja: d.numeroCaja.trim() }),
    ...(d.unidadEmpaque !== undefined && { unidadEmpaque: d.unidadEmpaque }),
    ...(d.horaInicio !== undefined && { horaInicio: new Date(d.horaInicio) }),
    ...(d.horaFinalizacion !== undefined && { horaFinalizacion: d.horaFinalizacion ? new Date(d.horaFinalizacion) : null }),
    ...(d.motivoCorreccion !== undefined && { motivoCorreccion: d.motivoCorreccion.trim() }),
  };

  if (d.hayReguero !== undefined) {
    data.hayReguero = d.hayReguero;
    data.cantidadReguero = d.hayReguero ? (d.cantidadReguero ?? null) : null;
  } else if (d.cantidadReguero !== undefined) {
    data.cantidadReguero = d.cantidadReguero;
  }

  if (d.plu !== undefined) {
    const plu = normalizePlu(d.plu);
    const producto = await prisma.productoMaestro.findUnique({ where: { plu }, select: { descripcion: true } });
    if (!producto?.descripcion?.trim()) {
      return NextResponse.json({ error: "PLU no encontrado en maestro" }, { status: 400 });
    }
    data.plu = plu;
    data.descripcion = producto.descripcion.trim();
  }

  const row = await prisma.etiquetadoExportacion.update({
    where: { id },
    data,
    include: {
      creadoPor: { select: { name: true } },
      actualizadoPor: { select: { name: true } },
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: "UPDATE",
      module: "exportaciones",
      recordId: id,
      details: d.motivoCorreccion ?? "Correccion de registro exportaciones",
    },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: mapExportacion(row) });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  if (!puedeGestionarExportaciones(actor.role)) {
    return NextResponse.json({ error: "Solo gestion puede eliminar Exportaciones" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const reason = typeof body?.motivoCorreccion === "string" && body.motivoCorreccion.trim()
    ? body.motivoCorreccion.trim()
    : "Borrado logico";

  const current = await prisma.etiquetadoExportacion.findUnique({ where: { id }, select: { deletedAt: true } });
  if (!current || current.deletedAt) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const row = await prisma.etiquetadoExportacion.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      actualizadoPorId: actor.id,
      motivoCorreccion: reason,
    },
    include: {
      creadoPor: { select: { name: true } },
      actualizadoPor: { select: { name: true } },
    },
  });

  await prisma.activityLog.create({
    data: { userId: actor.id, action: "DELETE", module: "exportaciones", recordId: id, details: reason },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: mapExportacion(row) });
}
