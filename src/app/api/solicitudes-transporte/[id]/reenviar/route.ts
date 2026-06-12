import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import { puedeGestionarSolicitudTransporte } from "@/lib/solicitudesTransporte";
import { mapSolicitudTransporte } from "../../route";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;

  const current = await prisma.solicitudTransporte.findUnique({
    where: { id },
    select: { estado: true, creadoPorId: true, solicitanteNombre: true, ciudadEntrega: true },
  });
  if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (actor.id !== current.creadoPorId && !puedeGestionarSolicitudTransporte(actor.role)) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }
  if (current.estado !== "RECHAZADA") {
    return NextResponse.json({ error: "Solo se pueden reenviar solicitudes rechazadas" }, { status: 409 });
  }

  const row = await prisma.solicitudTransporte.update({
    where: { id },
    data: {
      estado: "REENVIADA",
      motivoRechazo: null,
      rechazadoAt: null,
      reenviadoAt: new Date(),
      historial: {
        create: {
          estadoAnterior: "RECHAZADA",
          estadoNuevo: "REENVIADA",
          observacion: "Solicitud corregida y reenviada",
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
    data: { userId: actor.id, action: "RESUBMIT", module: "solicitudes-transporte", recordId: id, details: "Solicitud reenviada" },
  }).catch(() => {});

  const gestores = await prisma.user.findMany({
    where: { active: true, role: { in: ["ADMIN", "GERENTE", "SUPERVISOR_TRANSPORTE"] }, id: { not: actor.id } },
    select: { id: true },
  });
  await prisma.notificacion.createMany({
    data: gestores.map((u) => ({
      userId: u.id,
      titulo: "Solicitud de transporte reenviada",
      descripcion: `${current.solicitanteNombre} corrigio la solicitud hacia ${current.ciudadEntrega}`,
      tipo: "SOLICITUD_TRANSPORTE",
      enlace: "/dashboard/solicitudes-transporte",
    })),
  }).catch(() => {});

  return NextResponse.json({ success: true, data: mapSolicitudTransporte(row) });
}
