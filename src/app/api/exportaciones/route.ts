import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import {
  calcularDuracionMinutos,
  formatDateOnly,
  normalizePlu,
  puedeGestionarExportaciones,
  puedeUsarExportaciones,
  todayBogota,
  validarCapturaExportacion,
} from "@/lib/exportaciones";

const createSchema = z.object({
  numeroCaja: z.string().min(1).max(100),
  plu: z.string().min(1).max(100),
  unidadEmpaque: z.number().int().min(1),
});

export function mapExportacion(row: any) {
  return {
    id: row.id,
    numeroCaja: row.numeroCaja,
    plu: row.plu,
    descripcion: row.descripcion,
    unidadEmpaque: row.unidadEmpaque,
    fecha: formatDateOnly(row.fecha),
    horaInicio: row.horaInicio.toISOString(),
    horaFinalizacion: row.horaFinalizacion ? row.horaFinalizacion.toISOString() : null,
    duracionMinutos: calcularDuracionMinutos(row.horaInicio, row.horaFinalizacion),
    motivoCorreccion: row.motivoCorreccion ?? null,
    creadoPorId: row.creadoPorId,
    creadoPorNombre: row.creadoPor?.name ?? null,
    actualizadoPorId: row.actualizadoPorId ?? null,
    actualizadoPorNombre: row.actualizadoPor?.name ?? null,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  if (!puedeUsarExportaciones(actor.role)) {
    return NextResponse.json({ error: "Sin acceso a Exportaciones" }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const fecha = url.searchParams.get("fecha")?.trim();
  const usuarioId = url.searchParams.get("usuarioId")?.trim();
  const estado = url.searchParams.get("estado")?.trim();
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get("pageSize") || 40)));
  const isGestor = puedeGestionarExportaciones(actor.role);

  const where: any = {
    deletedAt: null,
    ...(isGestor ? {} : { creadoPorId: actor.id }),
    ...(isGestor && usuarioId ? { creadoPorId: usuarioId } : {}),
    ...(fecha ? { fecha: new Date(`${fecha}T00:00:00.000Z`) } : {}),
    ...(estado === "en-curso" ? { horaFinalizacion: null } : {}),
    ...(estado === "finalizado" ? { horaFinalizacion: { not: null } } : {}),
    ...(q ? {
      OR: [
        { numeroCaja: { contains: q, mode: "insensitive" } },
        { plu: { contains: q, mode: "insensitive" } },
        { descripcion: { contains: q, mode: "insensitive" } },
      ],
    } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.etiquetadoExportacion.findMany({
      where,
      include: {
        creadoPor: { select: { name: true } },
        actualizadoPor: { select: { name: true } },
      },
      orderBy: [{ horaInicio: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.etiquetadoExportacion.count({ where }),
  ]);

  return NextResponse.json({ success: true, data: items.map(mapExportacion), total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  if (!puedeUsarExportaciones(actor.role)) {
    return NextResponse.json({ error: "Sin acceso a Exportaciones" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const validation = validarCapturaExportacion(parsed.data);
  if (validation) return NextResponse.json({ error: validation }, { status: 400 });

  const plu = normalizePlu(parsed.data.plu);
  const producto = await prisma.productoMaestro.findUnique({
    where: { plu },
    select: { descripcion: true },
  });
  if (!producto?.descripcion?.trim()) {
    return NextResponse.json({ error: "PLU no encontrado en maestro" }, { status: 400 });
  }
  const descripcion = producto.descripcion.trim();

  const now = new Date();
  const created = await prisma.$transaction(async (tx) => {
    await tx.etiquetadoExportacion.updateMany({
      where: { creadoPorId: actor.id, horaFinalizacion: null, deletedAt: null },
      data: { horaFinalizacion: now },
    });
    return tx.etiquetadoExportacion.create({
      data: {
        numeroCaja: parsed.data.numeroCaja.trim(),
        plu,
        descripcion,
        unidadEmpaque: parsed.data.unidadEmpaque,
        fecha: todayBogota(now),
        horaInicio: now,
        creadoPorId: actor.id,
      },
      include: {
        creadoPor: { select: { name: true } },
        actualizadoPor: { select: { name: true } },
      },
    });
  });

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: "CREATE",
      module: "exportaciones",
      recordId: created.id,
      details: `Caja ${created.numeroCaja} PLU ${created.plu}`,
    },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: mapExportacion(created) }, { status: 201 });
}
