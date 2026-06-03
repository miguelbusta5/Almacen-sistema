import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireCan } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  estado:          z.enum(["PENDIENTE", "RECIBIDO", "DESPACHADO", "CON_NOVEDAD"]).optional(),
  novedad:         z.string().nullable().optional(),
  centroCostos:    z.string().max(100).optional(),
  numeroDocumento: z.string().max(100).optional(),
  consecutivo:     z.string().max(50).optional(),
  clienteNombre:   z.string().max(255).optional(),
  clienteDocumento:z.string().max(50).nullable().optional(),
  clienteTelefono: z.string().max(30).nullable().optional(),
});

function mapRow(r: any) {
  return {
    id: r.id,
    centroCostos:    r.centroCostos,
    numeroDocumento: r.numeroDocumento,
    consecutivo:     r.consecutivo,
    clienteNombre:   r.clienteNombre,
    clienteDocumento:r.clienteDocumento,
    clienteTelefono: r.clienteTelefono,
    estado:          r.estado,
    fechaCreacion:   r.fechaCreacion instanceof Date ? r.fechaCreacion.toISOString().slice(0, 10) : r.fechaCreacion,
    recibidoAt:      r.recibidoAt ? r.recibidoAt.toISOString() : null,
    despachadoAt:    r.despachadoAt ? r.despachadoAt.toISOString() : null,
    novedad:         r.novedad,
    creadoPorId:     r.creadoPorId,
    creadoPorNombre: r.creadoPor?.name ?? null,
    createdAt:       r.createdAt.toISOString(),
    updatedAt:       r.updatedAt.toISOString(),
  };
}

// GET /api/tienda/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;

  const row = await prisma.despachoTienda.findUnique({
    where: { id },
    include: { creadoPor: { select: { id: true, name: true } } },
  });
  if (!row) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Historial de activity logs relacionado
  const logs = await prisma.activityLog.findMany({
    where: { module: "tienda", recordId: id },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    success: true,
    data: mapRow(row),
    historial: logs.map((l) => ({
      action: l.action,
      details: l.details,
      userName: l.user?.name ?? null,
      createdAt: l.createdAt.toISOString(),
    })),
  });
}

// PUT /api/tienda/[id] — cambiar estado + datos opcionales
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const d = parsed.data;

  // Timestamps automáticos según el estado
  const timestamps: Record<string, unknown> = {};
  if (d.estado === "RECIBIDO")   timestamps.recibidoAt  = new Date();
  if (d.estado === "DESPACHADO") timestamps.despachadoAt = new Date();

  // Edición de datos → solo GERENTE/ADMIN vía requireCan
  const isDataEdit = d.centroCostos || d.numeroDocumento || d.clienteNombre;
  if (isDataEdit) {
    const check = await requireCan("edit");
    if (check instanceof NextResponse) return check;
  }

  const row = await prisma.despachoTienda.update({
    where: { id },
    data: {
      ...(d.estado !== undefined && { estado: d.estado }),
      ...(d.novedad !== undefined && { novedad: d.novedad }),
      ...(d.centroCostos    && { centroCostos: d.centroCostos }),
      ...(d.numeroDocumento && { numeroDocumento: d.numeroDocumento }),
      ...(d.consecutivo     && { consecutivo: d.consecutivo }),
      ...(d.clienteNombre   && { clienteNombre: d.clienteNombre }),
      ...(d.clienteDocumento !== undefined && { clienteDocumento: d.clienteDocumento }),
      ...(d.clienteTelefono  !== undefined && { clienteTelefono: d.clienteTelefono }),
      ...timestamps,
    },
    include: { creadoPor: { select: { id: true, name: true } } },
  });

  const detail = d.estado ? `Estado → ${d.estado}` : "Actualización";
  await prisma.activityLog.create({
    data: { userId: actor.id, action: "UPDATE", module: "tienda", recordId: id, details: detail },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: mapRow(row) });
}

// DELETE /api/tienda/[id] — solo ADMIN
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireCan("delete");
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;
  await prisma.despachoTienda.delete({ where: { id } });
  await prisma.activityLog.create({
    data: { userId: actor.id, action: "DELETE", module: "tienda", recordId: id },
  }).catch(() => {});
  return NextResponse.json({ success: true });
}
