import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/authz";
import {
  calcularPrioridadSolicitudTransporte,
  calcularSemaforoSolicitudTransporte,
  estadoDesdeStella,
  mesSolicitud,
  parseDateOnly,
  puedeEliminarSolicitudTransporte,
  puedeGestionarSolicitudTransporte,
  puedeVerSolicitudTransporte,
  TRANSPORTADORA_OPTIONS,
  validarFlete,
  validarPlinesSolicitudTransporte,
} from "@/lib/solicitudesTransporte";
import { mapSolicitudTransporte } from "../route";

const stellaSchema = z.enum(["PENDIENTE", "PROGRAMADO", "EFECTUADO", "CANCELADO"]);
const transportadoraSchema = z.enum(TRANSPORTADORA_OPTIONS);

const gestionSchema = z.object({
  documentoNetSuite: z.string().max(120).optional().nullable(),
  stellaEstado: stellaSchema.optional(),
  transportadora: transportadoraSchema.optional().nullable(),
  numeroGuia: z.string().max(120).optional().nullable(),
  fechaProgramacion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  observacionTransporte: z.string().optional().nullable(),
});

const patchSchema = z.object({
  fechaSolicitud: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  areaSolicitante: z.string().min(2).max(80).optional(),
  areaOtro: z.string().max(120).optional().nullable(),
  solicitanteNombre: z.string().min(2).max(255).optional(),
  solicitanteCorreo: z.string().email().max(255).optional(),
  solicitanteTelefono: z.string().min(1).max(40).optional(),
  tipoVenta: z.string().min(1).max(40).optional(),
  numeroPedido: z.string().min(1).max(120).optional(),
  facturaIntegracion: z.string().max(120).optional().nullable(),
  cobroFlete: z.boolean().optional(),
  valorFlete: z.number().nonnegative().optional().nullable(),
  cantidadCajas: z.number().int().min(1).optional(),
  unidades: z.number().int().min(1).optional().nullable(),
  volumenEstimado: z.string().min(1).max(30).optional(),
  tipoMercancia: z.string().min(1).max(40).optional(),
  ciudadOrigen: z.string().min(2).max(80).optional(),
  zonaRecogida: z.string().min(1).max(20).optional(),
  direccionRecogida: z.string().min(3).optional(),
  puntoRecogida: z.string().min(1).max(255).optional(),
  puntoRecogidaOtro: z.string().max(255).optional().nullable(),
  ciudadEntrega: z.string().min(2).max(80).optional(),
  direccionEntrega: z.string().min(5).optional(),
  zonaEntrega: z.string().min(1).max(20).optional(),
  fechaPromesaEntrega: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  ventanaEntrega: z.string().min(1).max(40).optional(),
  restriccionHoraria: z.boolean().optional(),
  descripcionRestriccion: z.string().optional().nullable(),
  tipoServicio: z.string().min(1).max(80).optional(),
  tipoServicioOtro: z.string().max(120).optional().nullable(),
  observacionesSolicitante: z.string().min(1).optional(),
  plines: z.array(z.object({
    plu: z.string().min(1).max(100),
    descripcion: z.string().min(1).max(255),
    unidades: z.number().int().min(1),
  })).min(1).optional(),
}).merge(gestionSchema);

function recalcular(fechaSolicitud: Date, fechaPromesaEntrega: Date | null, stellaEstado: "PENDIENTE" | "PROGRAMADO" | "EFECTUADO" | "CANCELADO") {
  return {
    prioridad: calcularPrioridadSolicitudTransporte(fechaSolicitud, fechaPromesaEntrega),
    semaforo: calcularSemaforoSolicitudTransporte({ stellaEstado, fechaPromesaEntrega }),
    mesSolicitud: mesSolicitud(fechaSolicitud),
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;

  const row = await prisma.solicitudTransporte.findUnique({
    where: { id },
    include: {
      creadoPor: { select: { id: true, name: true } },
      gestionadoPor: { select: { id: true, name: true } },
      plines: true,
      historial: {
        include: { usuario: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!row || row.deletedAt) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (!puedeVerSolicitudTransporte(actor.role, actor.id, row.creadoPorId)) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  return NextResponse.json({
    success: true,
    data: mapSolicitudTransporte(row),
    historial: row.historial.map((h) => ({
      id: h.id,
      estadoAnterior: h.estadoAnterior,
      estadoNuevo: h.estadoNuevo,
      observacion: h.observacion,
      usuarioNombre: h.usuario?.name ?? null,
      createdAt: h.createdAt.toISOString(),
    })),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;

  const current = await prisma.solicitudTransporte.findUnique({
    where: { id },
    select: {
      id: true,
      estado: true,
      stellaEstado: true,
      creadoPorId: true,
      fechaSolicitud: true,
      fechaPromesaEntrega: true,
      cobroFlete: true,
      valorFlete: true,
      deletedAt: true,
    },
  });
  if (!current || current.deletedAt) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (!puedeVerSolicitudTransporte(actor.role, actor.id, current.creadoPorId)) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const gestionKeys = ["documentoNetSuite", "stellaEstado", "transportadora", "numeroGuia", "fechaProgramacion", "observacionTransporte"] as const;
  const isGestion = gestionKeys.some((key) => d[key] !== undefined);
  const isSolicitanteEdit = Object.keys(d).some((key) => !(gestionKeys as readonly string[]).includes(key));

  if (isGestion && !puedeGestionarSolicitudTransporte(actor.role)) {
    return NextResponse.json({ error: "Solo transporte puede gestionar la solicitud" }, { status: 403 });
  }
  if (isSolicitanteEdit) {
    const puedeEditar = actor.id === current.creadoPorId && ["PENDIENTE", "RECHAZADA", "REENVIADA"].includes(current.estado);
    const puedeEditarAdmin = puedeEliminarSolicitudTransporte(actor.role);
    if (!puedeEditar && !puedeGestionarSolicitudTransporte(actor.role)) {
      return NextResponse.json({ error: "Solo puedes editar solicitudes pendientes o rechazadas propias" }, { status: 403 });
    }
    if (["PROGRAMADA", "EFECTUADA", "CANCELADA"].includes(current.estado) && !puedeGestionarSolicitudTransporte(actor.role) && !puedeEditarAdmin) {
      return NextResponse.json({ error: "La solicitud ya esta en gestion de transporte" }, { status: 409 });
    }
  }

  const fechaSolicitud = parseDateOnly(d.fechaSolicitud) ?? current.fechaSolicitud;
  const fechaPromesaEntrega = d.fechaPromesaEntrega !== undefined
    ? parseDateOnly(d.fechaPromesaEntrega)
    : current.fechaPromesaEntrega;
  if (d.fechaPromesaEntrega !== undefined && !fechaPromesaEntrega) {
    return NextResponse.json({ error: "Fecha promesa invalida" }, { status: 400 });
  }
  const nextCobroFlete = d.cobroFlete ?? current.cobroFlete;
  const nextValorFlete = d.valorFlete !== undefined ? d.valorFlete : (current.valorFlete === null ? null : Number(current.valorFlete));
  const fleteError = validarFlete(nextCobroFlete, nextValorFlete);
  if (fleteError) return NextResponse.json({ error: fleteError }, { status: 400 });
  const plinesError = d.plines ? validarPlinesSolicitudTransporte(d.plines) : null;
  if (plinesError) return NextResponse.json({ error: plinesError }, { status: 400 });
  const stellaEstado = (d.stellaEstado ?? current.stellaEstado) as "PENDIENTE" | "PROGRAMADO" | "EFECTUADO" | "CANCELADO";
  const calculated = recalcular(fechaSolicitud, fechaPromesaEntrega, stellaEstado);
  const nextEstado = isGestion && d.stellaEstado ? estadoDesdeStella(d.stellaEstado) : current.estado;
  const cantidadCajas = d.cantidadCajas ?? d.unidades ?? undefined;

  const row = await prisma.solicitudTransporte.update({
    where: { id },
    data: {
      ...(d.fechaSolicitud !== undefined && { fechaSolicitud }),
      ...(d.areaSolicitante !== undefined && { areaSolicitante: d.areaSolicitante }),
      ...(d.areaOtro !== undefined && { areaOtro: d.areaOtro }),
      ...(d.solicitanteNombre !== undefined && { solicitanteNombre: d.solicitanteNombre }),
      ...(d.solicitanteCorreo !== undefined && { solicitanteCorreo: d.solicitanteCorreo }),
      ...(d.solicitanteTelefono !== undefined && { solicitanteTelefono: d.solicitanteTelefono }),
      ...(d.tipoVenta !== undefined && { tipoVenta: d.tipoVenta }),
      ...(d.numeroPedido !== undefined && { numeroPedido: d.numeroPedido }),
      ...(d.facturaIntegracion !== undefined && { facturaIntegracion: d.facturaIntegracion }),
      ...(d.cobroFlete !== undefined && { cobroFlete: d.cobroFlete }),
      ...(d.valorFlete !== undefined || d.cobroFlete === false ? { valorFlete: d.cobroFlete === false ? null : d.valorFlete } : {}),
      ...(cantidadCajas !== undefined && { unidades: cantidadCajas }),
      ...(d.volumenEstimado !== undefined && { volumenEstimado: d.volumenEstimado }),
      ...(d.tipoMercancia !== undefined && { tipoMercancia: d.tipoMercancia }),
      ...(d.ciudadOrigen !== undefined && { ciudadOrigen: d.ciudadOrigen }),
      ...(d.zonaRecogida !== undefined && { zonaRecogida: d.zonaRecogida }),
      ...(d.direccionRecogida !== undefined && { direccionRecogida: d.direccionRecogida }),
      ...(d.puntoRecogida !== undefined && { puntoRecogida: d.puntoRecogida }),
      ...(d.puntoRecogidaOtro !== undefined && { puntoRecogidaOtro: d.puntoRecogidaOtro }),
      ...(d.ciudadEntrega !== undefined && { ciudadEntrega: d.ciudadEntrega }),
      ...(d.direccionEntrega !== undefined && { direccionEntrega: d.direccionEntrega }),
      ...(d.zonaEntrega !== undefined && { zonaEntrega: d.zonaEntrega }),
      ...(d.fechaPromesaEntrega !== undefined && { fechaPromesaEntrega }),
      ...(d.ventanaEntrega !== undefined && { ventanaEntrega: d.ventanaEntrega }),
      ...(d.restriccionHoraria !== undefined && { restriccionHoraria: d.restriccionHoraria }),
      ...(d.descripcionRestriccion !== undefined && { descripcionRestriccion: d.descripcionRestriccion }),
      ...(d.tipoServicio !== undefined && { tipoServicio: d.tipoServicio }),
      ...(d.tipoServicioOtro !== undefined && { tipoServicioOtro: d.tipoServicioOtro }),
      ...(d.observacionesSolicitante !== undefined && { observacionesSolicitante: d.observacionesSolicitante }),
      ...(d.plines !== undefined && {
        plines: {
          deleteMany: {},
          create: d.plines.map((p) => ({
            plu: p.plu.trim().toUpperCase(),
            descripcion: p.descripcion.trim(),
            unidades: p.unidades,
          })),
        },
      }),
      ...(isGestion && {
        ...(d.documentoNetSuite !== undefined && { documentoNetSuite: d.documentoNetSuite }),
        ...(d.stellaEstado !== undefined && { stellaEstado: d.stellaEstado, estado: nextEstado }),
        ...(d.transportadora !== undefined && { transportadora: d.transportadora }),
        ...(d.numeroGuia !== undefined && { numeroGuia: d.numeroGuia }),
        ...(d.fechaProgramacion !== undefined && { fechaProgramacion: parseDateOnly(d.fechaProgramacion) }),
        ...(d.observacionTransporte !== undefined && { observacionTransporte: d.observacionTransporte }),
        gestionadoPorId: actor.id,
      }),
      prioridad: calculated.prioridad,
      semaforo: calculated.semaforo,
      mesSolicitud: calculated.mesSolicitud,
      ...(current.estado === "RECHAZADA" && isSolicitanteEdit && { estado: "REENVIADA", motivoRechazo: null, rechazadoAt: null, reenviadoAt: new Date() }),
      ...(current.estado !== nextEstado && isGestion && {
        historial: {
          create: {
            estadoAnterior: current.estado,
            estadoNuevo: nextEstado,
            observacion: d.observacionTransporte ?? null,
            usuarioId: actor.id,
          },
        },
      }),
    },
    include: {
      creadoPor: { select: { name: true } },
      gestionadoPor: { select: { name: true } },
      plines: true,
    },
  });

  await prisma.activityLog.create({
    data: { userId: actor.id, action: "UPDATE", module: "solicitudes-transporte", recordId: id, details: isGestion ? "Gestion transporte actualizada" : "Solicitud actualizada" },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: mapSolicitudTransporte(row) });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  if (!puedeEliminarSolicitudTransporte(actor.role)) {
    return NextResponse.json({ error: "Solo ADMIN o GERENTE pueden borrar solicitudes" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const reason = typeof body?.deleteReason === "string" && body.deleteReason.trim()
    ? body.deleteReason.trim()
    : "Eliminada por administracion";

  const current = await prisma.solicitudTransporte.findUnique({
    where: { id },
    select: { estado: true, deletedAt: true },
  });
  if (!current || current.deletedAt) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const row = await prisma.solicitudTransporte.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      deletedById: actor.id,
      deleteReason: reason,
      historial: {
        create: {
          estadoAnterior: current.estado,
          estadoNuevo: current.estado,
          observacion: `Borrado logico: ${reason}`,
          usuarioId: actor.id,
        },
      },
    },
    include: {
      creadoPor: { select: { name: true } },
      gestionadoPor: { select: { name: true } },
      plines: true,
    },
  });

  await prisma.activityLog.create({
    data: { userId: actor.id, action: "DELETE", module: "solicitudes-transporte", recordId: id, details: reason },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: mapSolicitudTransporte(row) });
}
