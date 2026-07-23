import { NextRequest, NextResponse } from "next/server";
import { requireCan } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  ubicacion:    z.string().min(1).optional(),
  estado:       z.enum(["PENDIENTE DESPACHO", "DESPACHADO"]).optional(),
  tipo:         z.enum(["COMUN", "ECOMMERCE"]).optional(),
  fechaDespacho:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  nota:         z.string().nullable().optional(),
  ciudad:       z.string().max(100).nullable().optional(),
  codigoTienda: z.string().max(50).nullable().optional(),
  nombreTienda: z.string().max(255).nullable().optional(),
  netsuiteId:   z.string().max(100).nullable().optional(),
  // Solo ADMIN puede modificar la fecha de ingreso (afecta almacenaje)
  fecha:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// PUT /api/transporte/[clientId] — actualiza un guardado
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const actor = await requireCan("edit");
  if (actor instanceof NextResponse) return actor;

  const { clientId } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;
  const esDesp = d.estado === "DESPACHADO";

  // Cambiar fecha de ingreso requiere ADMIN (afecta cálculo de almacenaje)
  if (d.fecha !== undefined && actor.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo el administrador puede modificar la fecha de ingreso" }, { status: 403 });
  }

  const row = await prisma.transporteGuardado.update({
    where: { client_id: clientId },
    data: {
      ...(d.fecha !== undefined && { fecha: new Date(d.fecha + "T00:00:00") }),
      ...(d.ubicacion !== undefined && { ubicacion: d.ubicacion }),
      ...(d.estado !== undefined && { estado: d.estado }),
      ...(d.tipo !== undefined && { tipo: d.tipo }),
      fecha_despacho: esDesp
        ? new Date((d.fechaDespacho || new Date().toISOString().slice(0, 10)) + "T00:00:00")
        : d.estado === "PENDIENTE DESPACHO"
        ? null
        : undefined,
      ...(d.nota       !== undefined && { nota: d.nota }),
      ...(d.ciudad     !== undefined && { ciudad: d.ciudad }),
      ...(d.codigoTienda !== undefined && { codigoTienda: d.codigoTienda }),
      ...(d.nombreTienda !== undefined && { nombreTienda: d.nombreTienda }),
      ...(d.netsuiteId !== undefined && { netsuiteId: d.netsuiteId }),
      updated_at: new Date(),
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: "UPDATE",
      module: "transporte",
      recordId: clientId,
      details: `Estado: ${row.estado}`,
    },
  }).catch(() => {});

  return NextResponse.json({ success: true });
}

// DELETE /api/transporte/[clientId] — borra + registra tombstone permanente (solo ADMIN)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const actor = await requireCan("delete");
  if (actor instanceof NextResponse) return actor;

  const { clientId } = await params;

  // Borrar el registro (si existe)
  await prisma.transporteGuardado
    .delete({ where: { client_id: clientId } })
    .catch(() => {}); // ignora si no existe

  // Tombstone permanente: bloquea cualquier re-inserción futura
  await prisma.transporteDeleted.upsert({
    where: { client_id: clientId },
    update: {},
    create: { client_id: clientId },
  });

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: "DELETE",
      module: "transporte",
      recordId: clientId,
    },
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
