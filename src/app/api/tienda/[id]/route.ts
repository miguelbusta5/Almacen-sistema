import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireCan } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { esTransicionValida, rolPuedeTransicionar } from "@/lib/tiendaFlow";
import type { EstadoDespacho } from "@/lib/tiendaFlow";
import { getErrorCode } from "@/lib/errors";
import type { Prisma } from "@prisma/client";

export type DespachoTiendaRow = Prisma.DespachoTiendaGetPayload<{
  include: {
    creadoPor: { select: { id: true; name: true } };
    plines: true;
    guardadoPendiente: { include: { asignadoA: { select: { name: true } } } };
  };
}>;

const updateSchema = z.object({
  // Estado — flujo simplificado tienda -> CEDI -> cliente
  estado: z.enum([
    "CREADO_TIENDA", "RECHAZADO", "RECOGIDO_TIENDA", "ENTREGADO_CEDI",
    "ENVIADO_CLIENTE", "CON_NOVEDAD",
  ]).optional(),
  motivoRechazo: z.string().min(5).nullable().optional(),
  // Optimistic lock
  updatedAt: z.string().datetime().optional(),
  // Evidencias por etapa
  fotoRecogidaUrl:  z.string().url().nullable().optional(),
  fotoCediUrl:      z.string().url().nullable().optional(),
  recibidoPorCedi:  z.string().max(255).nullable().optional(),
  observacionEntrega:z.string().nullable().optional(),
  // Datos opcionales
  novedad:           z.string().nullable().optional(),
  netsuiteId:        z.string().max(100).nullable().optional(),
  // Datos editables (requieren "edit" permission)
  centroCostos:      z.string().max(100).optional(),
  numeroDocumento:   z.string().max(100).optional(),
  consecutivo:       z.string().max(50).optional(),
  clienteNombre:     z.string().max(255).optional(),
  clienteDocumento:  z.string().max(50).nullable().optional(),
  clienteTelefono:   z.string().max(30).nullable().optional(),
  fechaEntregaComprometida: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  numeroCajas:       z.number().int().min(1).nullable().optional(),
  notaEntrega:       z.string().nullable().optional(),
  direccionEntrega:  z.string().nullable().optional(),
  barrio:            z.string().nullable().optional(),
  ciudad:            z.string().nullable().optional(),
  departamento:      z.string().nullable().optional(),
  latitud:           z.number().nullable().optional(),
  longitud:          z.number().nullable().optional(),
  contactoEntrega:   z.string().nullable().optional(),
  telefonoEntrega:   z.string().max(30).nullable().optional(),
});

export const ESTADO_LABEL: Record<string, string> = {
  CREADO_TIENDA:      "Creado en tienda",
  RECHAZADO:          "Rechazado",
  RECOGIDO_TIENDA:    "Recogido en tienda",
  ENTREGADO_CEDI:     "Entregado en CEDI",
  ENVIADO_CLIENTE:    "Enviado al cliente",
  CON_NOVEDAD:        "Con novedad",
};

export function mapRow(r: DespachoTiendaRow): object {
  return {
    id:               r.id,
    centroCostos:     r.centroCostos,
    numeroDocumento:  r.numeroDocumento,
    consecutivo:      r.consecutivo,
    clienteNombre:    r.clienteNombre,
    clienteDocumento: r.clienteDocumento,
    clienteTelefono:  r.clienteTelefono,
    estado:           r.estado,
    fechaCreacion:    r.fechaCreacion instanceof Date ? r.fechaCreacion.toISOString().slice(0, 10) : r.fechaCreacion,
    fechaEntregaComprometida: r.fechaEntregaComprometida instanceof Date
      ? r.fechaEntregaComprometida.toISOString().slice(0, 10)
      : (r.fechaEntregaComprometida ?? null),
    numeroCajas:      r.numeroCajas ?? null,
    netsuiteId:       r.netsuiteId ?? null,
    // Timestamps
    recibidoAt:         r.recibidoAt    ? r.recibidoAt.toISOString()    : null,
    entregadoCediAt:    r.entregadoCediAt ? r.entregadoCediAt.toISOString() : null,
    despachadoAt:       r.despachadoAt  ? r.despachadoAt.toISOString()  : null,
    novedadAt:          r.novedadAt     ? r.novedadAt.toISOString()     : null,
    rechazadoAt:        r.rechazadoAt   ? r.rechazadoAt.toISOString()   : null,
    motivoRechazo:      r.motivoRechazo ?? null,
    notaEntrega:       r.notaEntrega ?? null,
    guardadoPendiente: r.guardadoPendiente ? {
      id: r.guardadoPendiente.id,
      estado: r.guardadoPendiente.estado,
      asignadoAId: r.guardadoPendiente.asignadoAId,
      asignadoANombre: r.guardadoPendiente.asignadoA?.name ?? null,
      guardadoClientId: r.guardadoPendiente.guardadoClientId ?? null,
    } : null,
    // Dirección
    direccionEntrega: r.direccionEntrega ?? null,
    barrio:           r.barrio ?? null,
    ciudad:           r.ciudad ?? null,
    departamento:     r.departamento ?? null,
    latitud:          r.latitud ?? null,
    longitud:         r.longitud ?? null,
    // Contacto
    contactoEntrega:  r.contactoEntrega ?? null,
    telefonoEntrega:  r.telefonoEntrega ?? null,
    // Evidencias
    fotoRecogidaUrl:  r.fotoRecogidaUrl ?? null,
    fotoCediUrl:      r.fotoCediUrl ?? null,
    recibidoPorCedi:  r.recibidoPorCedi ?? null,
    observacionEntrega: r.observacionEntrega ?? null,
    fechaEntregaReal:   r.fechaEntregaReal  ? r.fechaEntregaReal.toISOString()  : null,
    novedad:          r.novedad ?? null,
    creadoPorId:      r.creadoPorId,
    creadoPorNombre:  r.creadoPor?.name ?? null,
    createdAt:        r.createdAt.toISOString(),
    updatedAt:        r.updatedAt.toISOString(),
    plines:           r.plines ?? [],
  };
}

// GET /api/tienda/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;

  const row = await prisma.despachoTienda.findUnique({
    where: { id },
    include: {
      creadoPor:       { select: { id: true, name: true } },
      plines: true,
      guardadoPendiente: { include: { asignadoA: { select: { name: true } } } },
    },
  });
  if (!row) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

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
      action: l.action, details: l.details,
      userName: l.user?.name ?? null, createdAt: l.createdAt.toISOString(),
    })),
  });
}

// PUT /api/tienda/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;

  // Fetch estado actual para validar máquina de estados
  const current = await prisma.despachoTienda.findUnique({
    where: { id },
    select: { estado: true, updatedAt: true, creadoPorId: true, numeroDocumento: true },
  });
  if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Validación de máquina de estados + rol
  if (d.estado && d.estado !== current.estado) {
    const origen = current.estado as EstadoDespacho;
    const destino = d.estado as EstadoDespacho;

    if (!esTransicionValida(origen, destino)) {
      return NextResponse.json({
        error: `Transición inválida: ${origen} → ${destino}`,
        code: "INVALID_TRANSITION",
      }, { status: 400 });
    }
    if (!rolPuedeTransicionar(actor.role, origen, destino)) {
      return NextResponse.json({ error: "Sin permiso para esta transición de estado" }, { status: 403 });
    }

    if (destino === "CON_NOVEDAD") {
      if (!d.novedad || d.novedad.trim().length < 5) {
        return NextResponse.json({ error: "Descripción de novedad obligatoria (mínimo 5 caracteres)" }, { status: 400 });
      }
    }
    if (destino === "RECHAZADO") {
      if (!d.motivoRechazo?.trim() || d.motivoRechazo.trim().length < 5) {
        return NextResponse.json({ error: "Debes indicar el motivo del rechazo (mínimo 5 caracteres)" }, { status: 400 });
      }
    }
  }

  // Edición de datos básicos: TIENDA solo corrige solicitudes rechazadas.
  const basicEditKeys = [
    "centroCostos", "numeroDocumento", "consecutivo", "clienteNombre",
    "clienteDocumento", "clienteTelefono", "fechaEntregaComprometida",
    "numeroCajas", "notaEntrega", "direccionEntrega", "barrio", "ciudad",
    "departamento", "latitud", "longitud", "contactoEntrega", "telefonoEntrega",
  ] as const;
  const isDataEdit = basicEditKeys.some((key) => d[key] !== undefined);
  if (isDataEdit) {
    const puedeEditarBasico = ["TIENDA", "SUPERVISOR_TIENDA", "SUPERVISOR_TRANSPORTE", "GERENTE", "ADMIN"].includes(actor.role);
    if (!puedeEditarBasico) return NextResponse.json({ error: "Sin permiso para editar datos de tienda" }, { status: 403 });
    if (actor.role === "TIENDA" && current.estado !== "RECHAZADO") {
      return NextResponse.json({ error: "TIENDA solo puede editar solicitudes rechazadas" }, { status: 409 });
    }
    if (actor.role !== "TIENDA" && current.estado !== "CREADO_TIENDA" && current.estado !== "RECHAZADO" && !["GERENTE", "ADMIN"].includes(actor.role)) {
      return NextResponse.json({ error: "Solo se puede editar información básica mientras el despacho está en CREADO_TIENDA o RECHAZADO" }, { status: 409 });
    }
  }

  // Timestamps automáticos
  const timestamps: Record<string, unknown> = {};
  if (d.estado === "RECOGIDO_TIENDA")    timestamps.recibidoAt         = new Date();
  if (d.estado === "ENTREGADO_CEDI")     timestamps.entregadoCediAt    = new Date();
  if (d.estado === "ENVIADO_CLIENTE")    timestamps.despachadoAt       = new Date();
  if (d.estado === "CON_NOVEDAD")        timestamps.novedadAt          = new Date();
  if (d.estado === "RECHAZADO")          { timestamps.rechazadoAt = new Date(); timestamps.motivoRechazo = d.motivoRechazo!.trim(); }
  if (current.estado === "RECHAZADO" && d.estado === "CREADO_TIENDA") { timestamps.motivoRechazo = null; timestamps.rechazadoAt = null; }

  // Update con optimistic lock (comparar updatedAt numéricamente — nota A)
  try {
    const estadoCambia = d.estado && d.estado !== current.estado;
    const lockUpdatedAt = d.updatedAt ? new Date(d.updatedAt) : undefined;

    const [updatedRow] = await prisma.$transaction([
      prisma.despachoTienda.update({
        where: {
          id,
          ...(lockUpdatedAt ? { updatedAt: lockUpdatedAt } : {}),
        },
        data: {
          ...(d.estado !== undefined && { estado: d.estado }),
          ...(d.novedad           !== undefined && { novedad: d.novedad }),
          ...(d.netsuiteId        !== undefined && { netsuiteId: d.netsuiteId }),
          ...(d.fotoRecogidaUrl     !== undefined && { fotoRecogidaUrl: d.fotoRecogidaUrl }),
          ...(d.fotoCediUrl         !== undefined && { fotoCediUrl: d.fotoCediUrl }),
          ...(d.recibidoPorCedi     !== undefined && { recibidoPorCedi: d.recibidoPorCedi }),
          ...(d.observacionEntrega  !== undefined && { observacionEntrega: d.observacionEntrega }),
          ...(d.centroCostos        && { centroCostos: d.centroCostos }),
          ...(d.numeroDocumento     && { numeroDocumento: d.numeroDocumento }),
          ...(d.consecutivo         && { consecutivo: d.consecutivo }),
          ...(d.clienteNombre       && { clienteNombre: d.clienteNombre }),
          ...(d.clienteDocumento    !== undefined && { clienteDocumento: d.clienteDocumento }),
          ...(d.clienteTelefono     !== undefined && { clienteTelefono: d.clienteTelefono }),
          ...(d.fechaEntregaComprometida !== undefined && {
            fechaEntregaComprometida: d.fechaEntregaComprometida
              ? new Date(d.fechaEntregaComprometida + "T00:00:00") : null,
          }),
          ...(d.numeroCajas !== undefined && { numeroCajas: d.numeroCajas }),
          ...(d.notaEntrega !== undefined && { notaEntrega: d.notaEntrega }),
          ...(d.direccionEntrega !== undefined && { direccionEntrega: d.direccionEntrega }),
          ...(d.barrio      !== undefined && { barrio: d.barrio }),
          ...(d.ciudad      !== undefined && { ciudad: d.ciudad }),
          ...(d.departamento !== undefined && { departamento: d.departamento }),
          ...(d.latitud     !== undefined && { latitud: d.latitud }),
          ...(d.longitud    !== undefined && { longitud: d.longitud }),
          ...(d.contactoEntrega !== undefined && { contactoEntrega: d.contactoEntrega }),
          ...(d.telefonoEntrega !== undefined && { telefonoEntrega: d.telefonoEntrega }),
          ...timestamps,
        },
        include: {
          creadoPor:         { select: { id: true, name: true } },
          plines: true,
          guardadoPendiente: { include: { asignadoA: { select: { name: true } } } },
        },
      }),
      // HistorialDespacho — solo si cambia el estado
      ...(estadoCambia ? [prisma.historialDespacho.create({
        data: {
          despachoId:     id,
          estadoAnterior: current.estado,
          estadoNuevo:    d.estado!,
          observacion:    d.observacionEntrega ?? d.novedad ?? null,
          usuarioId:      actor.id,
        },
      })] : []),
    ]);

    const detail = d.estado ? `Estado → ${ESTADO_LABEL[d.estado] ?? d.estado}` : "Actualización";
    await prisma.activityLog.create({
      data: { userId: actor.id, action: "UPDATE", module: "tienda", recordId: id, details: detail },
    }).catch(() => {});

    if (d.estado === "RECHAZADO" && current.creadoPorId) {
      prisma.notificacion.create({
        data: {
          userId: current.creadoPorId,
          titulo: "Despacho rechazado por transporte",
          descripcion: `Doc. ${current.numeroDocumento}: ${(d.motivoRechazo ?? "").substring(0, 200)}`,
          tipo: "TIENDA",
          enlace: "/dashboard/tienda",
          leida: false,
        },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, data: mapRow(updatedRow) });
  } catch (e) {
    if (getErrorCode(e) === "P2025") {
      return NextResponse.json({ error: "Conflicto: el despacho fue modificado por otro usuario", code: "CONFLICT" }, { status: 409 });
    }
    throw e;
  }
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
