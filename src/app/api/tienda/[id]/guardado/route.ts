import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const assignSchema = z.object({
  asignadoAId: z.string().cuid(),
  nota: z.string().nullable().optional(),
});

function canAssign(role: string) {
  return ["SUPERVISOR_TRANSPORTE", "GERENTE", "ADMIN"].includes(role);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  if (!canAssign(actor.role)) {
    return NextResponse.json({ error: "Sin permiso para asignar guardado" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const [despacho, operario] = await Promise.all([
    prisma.despachoTienda.findUnique({ where: { id }, select: { id: true, estado: true, numeroDocumento: true, clienteNombre: true } }),
    prisma.user.findUnique({ where: { id: parsed.data.asignadoAId }, select: { id: true, role: true, active: true, name: true } }),
  ]);
  if (!despacho) return NextResponse.json({ error: "Despacho no encontrado" }, { status: 404 });
  if (!operario || !operario.active || operario.role !== "TRANSPORTE") {
    return NextResponse.json({ error: "Selecciona un operario activo con rol TRANSPORTE" }, { status: 400 });
  }
  if (despacho.estado !== "ENTREGADO_CEDI") {
    return NextResponse.json({ error: "Solo se puede enviar a guardado un despacho entregado en CEDI" }, { status: 409 });
  }

  const pendiente = await prisma.guardadoPendienteTienda.upsert({
    where: { despachoId: id },
    update: {
      asignadoAId: operario.id,
      asignadoPorId: actor.id,
      estado: "PENDIENTE",
      guardadoClientId: null,
      completadoAt: null,
      nota: parsed.data.nota ?? null,
    },
    create: {
      despachoId: id,
      asignadoAId: operario.id,
      asignadoPorId: actor.id,
      nota: parsed.data.nota ?? null,
    },
    include: {
      asignadoA: { select: { id: true, name: true, email: true } },
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: "ASSIGN_GUARDADO",
      module: "tienda",
      recordId: id,
      details: `${despacho.numeroDocumento} asignado a ${pendiente.asignadoA.name}`,
    },
  }).catch(() => {});

  // Notifica al operario asignado. El enlace va a Guardados (transporte):
  // el rol TRANSPORTE no tiene acceso al módulo tienda.
  if (operario.id !== actor.id) {
    await prisma.notificacion.create({
      data: {
        userId: operario.id,
        titulo: "Te asignaron un guardado",
        descripcion: `Doc. ${despacho.numeroDocumento} · ${despacho.clienteNombre}${parsed.data.nota ? ` · ${parsed.data.nota.substring(0, 120)}` : ""}`,
        tipo: "TIENDA",
        enlace: "/dashboard/transporte",
        leida: false,
      },
    }).catch(() => {});
  }

  return NextResponse.json({
    success: true,
    data: {
      id: pendiente.id,
      despachoId: pendiente.despachoId,
      asignadoAId: pendiente.asignadoAId,
      asignadoANombre: pendiente.asignadoA.name,
      estado: pendiente.estado,
      nota: pendiente.nota,
      createdAt: pendiente.createdAt.toISOString(),
    },
  });
}
