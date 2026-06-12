import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { puedeGestionarSolicitudTransporte, SOLICITUDES_TRANSPORTE_PATH } from "@/lib/solicitudesTransporte";
import { mapSolicitudTransporte } from "../../route";

const rejectSchema = z.object({
  motivoRechazo: z.string().min(5).max(1000),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  if (!puedeGestionarSolicitudTransporte(actor.role)) {
    return NextResponse.json({ error: "Sin permiso para rechazar solicitudes" }, { status: 403 });
  }
  const { id } = await params;
  const parsed = rejectSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const current = await prisma.solicitudTransporte.findUnique({
    where: { id },
    select: { estado: true, creadoPorId: true, numeroPedido: true, ciudadEntrega: true },
  });
  if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (["EFECTUADA", "CANCELADA"].includes(current.estado)) {
    return NextResponse.json({ error: "No se puede rechazar una solicitud finalizada" }, { status: 409 });
  }

  const row = await prisma.solicitudTransporte.update({
    where: { id },
    data: {
      estado: "RECHAZADA",
      motivoRechazo: parsed.data.motivoRechazo.trim(),
      rechazadoAt: new Date(),
      gestionadoPorId: actor.id,
      historial: {
        create: {
          estadoAnterior: current.estado,
          estadoNuevo: "RECHAZADA",
          observacion: parsed.data.motivoRechazo.trim(),
          usuarioId: actor.id,
        },
      },
    },
    include: {
      creadoPor: { select: { name: true } },
      gestionadoPor: { select: { name: true } },
    },
  });

  await prisma.activityLog.create({
    data: { userId: actor.id, action: "REJECT", module: "solicitudes-transporte", recordId: id, details: parsed.data.motivoRechazo.trim() },
  }).catch(() => {});

  await prisma.notificacion.create({
    data: {
      userId: current.creadoPorId,
      titulo: "Solicitud de transporte rechazada",
      descripcion: parsed.data.motivoRechazo.trim().slice(0, 200),
      tipo: "SOLICITUD_TRANSPORTE",
      enlace: SOLICITUDES_TRANSPORTE_PATH,
    },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: mapSolicitudTransporte(row) });
}
