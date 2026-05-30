import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateSchema = z.object({
  ubicacion: z.string().min(1).optional(),
  estado: z.enum(["PENDIENTE DESPACHO", "DESPACHADO"]).optional(),
  fechaDespacho: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  nota: z.string().nullable().optional(),
});

// PUT /api/transporte/[clientId] — actualiza un guardado
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { clientId } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;
  const esDesp = d.estado === "DESPACHADO";

  const row = await prisma.transporteGuardado.update({
    where: { client_id: clientId },
    data: {
      ...(d.ubicacion !== undefined && { ubicacion: d.ubicacion }),
      ...(d.estado !== undefined && { estado: d.estado }),
      fecha_despacho: esDesp
        ? new Date((d.fechaDespacho || new Date().toISOString().slice(0, 10)) + "T00:00:00")
        : d.estado === "PENDIENTE DESPACHO"
        ? null
        : undefined,
      ...(d.nota !== undefined && { nota: d.nota }),
      updated_at: new Date(),
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: (session.user as { id: string }).id,
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
  const actor = await requireRole(["ADMIN"]);
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
