import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getErrorMessage } from "@/lib/errors";
import type { Prisma } from "@prisma/client";

type PendienteRow = Prisma.GuardadoPendienteTiendaGetPayload<{
  include: {
    asignadoA: { select: { id: true; name: true } };
    despacho: true;
  };
}>;

const convertSchema = z.object({
  pendienteId: z.string().cuid(),
  ubicacion: z.string().min(1, "Ubicación requerida"),
  nota: z.string().nullable().optional(),
});

function canViewAll(role: string) {
  return ["SUPERVISOR_TRANSPORTE", "GERENTE", "ADMIN"].includes(role);
}

function mapPendiente(p: PendienteRow) {
  const d = p.despacho;
  return {
    id: p.id,
    despachoId: p.despachoId,
    estado: p.estado,
    nota: p.nota,
    guardadoClientId: p.guardadoClientId ?? null,
    createdAt: p.createdAt.toISOString(),
    completadoAt: p.completadoAt ? p.completadoAt.toISOString() : null,
    asignadoAId: p.asignadoAId,
    asignadoANombre: p.asignadoA?.name ?? null,
    despacho: {
      id: d.id,
      centroCostos: d.centroCostos,
      numeroDocumento: d.numeroDocumento,
      consecutivo: d.consecutivo,
      clienteNombre: d.clienteNombre,
      clienteDocumento: d.clienteDocumento ?? null,
      clienteTelefono: d.clienteTelefono ?? null,
      numeroCajas: d.numeroCajas ?? null,
      notaEntrega: d.notaEntrega ?? null,
      fechaEntregaComprometida: d.fechaEntregaComprometida ? d.fechaEntregaComprometida.toISOString().slice(0, 10) : null,
      entregadoCediAt: d.entregadoCediAt ? d.entregadoCediAt.toISOString() : null,
    },
  };
}

export async function GET() {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;

  const role = actor.role as string;
  if (role !== "TRANSPORTE" && !canViewAll(role)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const pendientes = await prisma.guardadoPendienteTienda.findMany({
    where: {
      estado: "PENDIENTE",
      ...(role === "TRANSPORTE" ? { asignadoAId: actor.id } : {}),
    },
    include: {
      asignadoA: { select: { id: true, name: true } },
      despacho: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ success: true, data: pendientes.map(mapPendiente) });
}

export async function POST(req: NextRequest) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  if (actor.role !== "TRANSPORTE" && !canViewAll(actor.role)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const parsed = convertSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { pendienteId, ubicacion, nota } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const pendiente = await tx.guardadoPendienteTienda.findUnique({
        where: { id: pendienteId },
        include: { despacho: { include: { plines: true } } },
      });
      if (!pendiente) throw new Error("PENDIENTE_NOT_FOUND");
      if (pendiente.estado !== "PENDIENTE") throw new Error("PENDIENTE_CLOSED");
      if (actor.role === "TRANSPORTE" && pendiente.asignadoAId !== actor.id) throw new Error("PENDIENTE_FORBIDDEN");

    const d = pendiente.despacho;
    const clientId = `td-${d.id.slice(-10)}-${Date.now().toString(36)}`;
    const notaFinal = [
      `Origen: despacho tienda ${d.numeroDocumento}`,
      `Cliente: ${d.clienteNombre}`,
      d.clienteTelefono ? `Telefono: ${d.clienteTelefono}` : null,
      d.notaEntrega ? `Nota entrega: ${d.notaEntrega}` : null,
      pendiente.nota ? `Nota supervisor: ${pendiente.nota}` : null,
      nota ? `Nota guardado: ${nota}` : null,
      d.plines.length > 0 ? `PLUs: ${d.plines.map((p) => `${p.plu} x${p.unidades}`).join(", ")}` : null,
    ].filter(Boolean).join("\n");

    const guardado = await tx.transporteGuardado.create({
      data: {
        client_id: clientId,
        fecha: new Date(),
        documento: d.numeroDocumento,
        ubicacion,
        estado: "PENDIENTE DESPACHO",
        tipo: "ECOMMERCE",
        nota: notaFinal,
        netsuiteId: d.netsuiteId ?? null,
      },
    });

    const cerrado = await tx.guardadoPendienteTienda.update({
      where: { id: pendiente.id },
      data: {
        estado: "CONVERTIDO",
        guardadoClientId: clientId,
        completadoAt: new Date(),
      },
      include: { asignadoA: { select: { id: true, name: true } }, despacho: true },
    });

    await tx.activityLog.create({
      data: {
        userId: actor.id,
        action: "CONVERT_TO_GUARDADO",
        module: "transporte",
        recordId: clientId,
        details: `${d.numeroDocumento} desde despacho tienda`,
      },
    }).catch(() => {});

      return { guardado, pendiente: cerrado };
    });

    return NextResponse.json({
      success: true,
      data: {
        clientId: result.guardado.client_id,
        documento: result.guardado.documento,
        ubicacion: result.guardado.ubicacion,
        pendiente: mapPendiente(result.pendiente),
      },
    }, { status: 201 });
  } catch (e) {
    const msg = getErrorMessage(e);
    if (msg === "PENDIENTE_NOT_FOUND") return NextResponse.json({ error: "Pendiente no encontrado" }, { status: 404 });
    if (msg === "PENDIENTE_CLOSED") return NextResponse.json({ error: "Este pendiente ya fue convertido" }, { status: 409 });
    if (msg === "PENDIENTE_FORBIDDEN") return NextResponse.json({ error: "Este pendiente no está asignado a tu usuario" }, { status: 403 });
    throw e;
  }
}
