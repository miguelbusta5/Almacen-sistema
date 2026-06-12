import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  calcularPrioridadSolicitudTransporte,
  calcularSemaforoSolicitudTransporte,
  estadoDesdeStella,
  mesSolicitud,
  parseDateOnly,
  puedeCrearSolicitudTransporte,
  puedeGestionarSolicitudTransporte,
  SOLICITUDES_TRANSPORTE_PATH,
} from "@/lib/solicitudesTransporte";
import { requireAuth } from "@/lib/authz";

const estadoSchema = z.enum(["PENDIENTE", "RECHAZADA", "REENVIADA", "PROGRAMADA", "EFECTUADA", "CANCELADA"]);
const prioridadSchema = z.enum(["ALTO", "MEDIO", "BAJO"]);
const semaforoSchema = z.enum(["SIN_FECHA", "VENCIDO", "ALERTA", "NORMAL", "EFECTUADO", "CANCELADO"]);

export const solicitudCreateSchema = z.object({
  fechaSolicitud: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  areaSolicitante: z.string().min(2).max(80),
  areaOtro: z.string().max(120).optional().nullable(),
  solicitanteNombre: z.string().min(2).max(255),
  solicitanteCorreo: z.string().email().max(255),
  solicitanteTelefono: z.string().max(40).optional().nullable(),
  tipoVenta: z.string().max(40).optional().nullable(),
  numeroPedido: z.string().max(120).optional().nullable(),
  facturaIntegracion: z.string().max(120).optional().nullable(),
  cobroFlete: z.boolean().optional().nullable(),
  valorFlete: z.number().nonnegative().optional().nullable(),
  unidades: z.number().int().min(1).optional().nullable(),
  volumenEstimado: z.string().max(30).optional().nullable(),
  tipoMercancia: z.string().max(40).optional().nullable(),
  ciudadOrigen: z.string().min(2).max(80),
  zonaRecogida: z.string().max(20).optional().nullable(),
  direccionRecogida: z.string().optional().nullable(),
  puntoRecogida: z.string().max(255).optional().nullable(),
  puntoRecogidaOtro: z.string().max(255).optional().nullable(),
  ciudadEntrega: z.string().min(2).max(80),
  direccionEntrega: z.string().min(5),
  zonaEntrega: z.string().max(20).optional().nullable(),
  fechaPromesaEntrega: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  ventanaEntrega: z.string().max(40).optional().nullable(),
  restriccionHoraria: z.boolean().optional().nullable(),
  descripcionRestriccion: z.string().optional().nullable(),
  tipoServicio: z.string().max(80).optional().nullable(),
  tipoServicioOtro: z.string().max(120).optional().nullable(),
  observacionesSolicitante: z.string().optional().nullable(),
});

export function mapSolicitudTransporte(row: any) {
  return {
    id: row.id,
    fechaSolicitud: row.fechaSolicitud ? row.fechaSolicitud.toISOString().slice(0, 10) : null,
    areaSolicitante: row.areaSolicitante,
    areaOtro: row.areaOtro,
    solicitanteNombre: row.solicitanteNombre,
    solicitanteCorreo: row.solicitanteCorreo,
    solicitanteTelefono: row.solicitanteTelefono,
    tipoVenta: row.tipoVenta,
    numeroPedido: row.numeroPedido,
    facturaIntegracion: row.facturaIntegracion,
    cobroFlete: row.cobroFlete,
    valorFlete: row.valorFlete === null || row.valorFlete === undefined ? null : Number(row.valorFlete),
    unidades: row.unidades,
    volumenEstimado: row.volumenEstimado,
    tipoMercancia: row.tipoMercancia,
    ciudadOrigen: row.ciudadOrigen,
    zonaRecogida: row.zonaRecogida,
    direccionRecogida: row.direccionRecogida,
    puntoRecogida: row.puntoRecogida,
    puntoRecogidaOtro: row.puntoRecogidaOtro,
    ciudadEntrega: row.ciudadEntrega,
    direccionEntrega: row.direccionEntrega,
    zonaEntrega: row.zonaEntrega,
    fechaPromesaEntrega: row.fechaPromesaEntrega ? row.fechaPromesaEntrega.toISOString().slice(0, 10) : null,
    ventanaEntrega: row.ventanaEntrega,
    restriccionHoraria: row.restriccionHoraria,
    descripcionRestriccion: row.descripcionRestriccion,
    tipoServicio: row.tipoServicio,
    tipoServicioOtro: row.tipoServicioOtro,
    observacionesSolicitante: row.observacionesSolicitante,
    estado: row.estado,
    stellaEstado: row.stellaEstado,
    documentoNetSuite: row.documentoNetSuite,
    transportadora: row.transportadora,
    numeroGuia: row.numeroGuia,
    fechaProgramacion: row.fechaProgramacion ? row.fechaProgramacion.toISOString().slice(0, 10) : null,
    observacionTransporte: row.observacionTransporte,
    prioridad: row.prioridad,
    semaforo: row.semaforo,
    mesSolicitud: row.mesSolicitud,
    motivoRechazo: row.motivoRechazo,
    rechazadoAt: row.rechazadoAt ? row.rechazadoAt.toISOString() : null,
    reenviadoAt: row.reenviadoAt ? row.reenviadoAt.toISOString() : null,
    creadoPorId: row.creadoPorId,
    creadoPorNombre: row.creadoPor?.name ?? null,
    gestionadoPorId: row.gestionadoPorId,
    gestionadoPorNombre: row.gestionadoPor?.name ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildCalculatedFields(input: {
  fechaSolicitud: Date;
  fechaPromesaEntrega: Date | null;
  stellaEstado?: "PENDIENTE" | "PROGRAMADO" | "EFECTUADO" | "CANCELADO";
}) {
  const stellaEstado = input.stellaEstado ?? "PENDIENTE";
  return {
    prioridad: calcularPrioridadSolicitudTransporte(input.fechaSolicitud, input.fechaPromesaEntrega),
    semaforo: calcularSemaforoSolicitudTransporte({ stellaEstado, fechaPromesaEntrega: input.fechaPromesaEntrega }),
    mesSolicitud: mesSolicitud(input.fechaSolicitud),
  };
}

async function notifyGestores(recordId: string, actorId: string, titulo: string, descripcion: string) {
  const gestores = await prisma.user.findMany({
    where: { active: true, role: { in: ["ADMIN", "GERENTE", "SUPERVISOR_TRANSPORTE"] }, id: { not: actorId } },
    select: { id: true },
  });
  if (gestores.length === 0) return;
  await prisma.notificacion.createMany({
    data: gestores.map((u) => ({
      userId: u.id,
      titulo,
      descripcion,
      tipo: "SOLICITUD_TRANSPORTE",
      enlace: `${SOLICITUDES_TRANSPORTE_PATH}?id=${recordId}`,
    })),
  }).catch(() => {});
}

export async function GET(req: NextRequest) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  if (actor.role === "TRANSPORTISTA") return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(10, Number(url.searchParams.get("pageSize") ?? 25)));
  const q = url.searchParams.get("q")?.trim();
  const estado = estadoSchema.safeParse(url.searchParams.get("estado")).success ? url.searchParams.get("estado") : null;
  const prioridad = prioridadSchema.safeParse(url.searchParams.get("prioridad")).success ? url.searchParams.get("prioridad") : null;
  const semaforo = semaforoSchema.safeParse(url.searchParams.get("semaforo")).success ? url.searchParams.get("semaforo") : null;
  const area = url.searchParams.get("area")?.trim();

  const where: any = {
    ...(puedeGestionarSolicitudTransporte(actor.role) ? {} : { creadoPorId: actor.id }),
    ...(estado ? { estado } : {}),
    ...(prioridad ? { prioridad } : {}),
    ...(semaforo ? { semaforo } : {}),
    ...(area ? { areaSolicitante: area } : {}),
    ...(q ? {
      OR: [
        { solicitanteNombre: { contains: q, mode: "insensitive" } },
        { numeroPedido: { contains: q, mode: "insensitive" } },
        { ciudadEntrega: { contains: q, mode: "insensitive" } },
        { transportadora: { contains: q, mode: "insensitive" } },
        { numeroGuia: { contains: q, mode: "insensitive" } },
      ],
    } : {}),
  };

  const [rows, total, kpis] = await Promise.all([
    prisma.solicitudTransporte.findMany({
      where,
      include: {
        creadoPor: { select: { name: true } },
        gestionadoPor: { select: { name: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.solicitudTransporte.count({ where }),
    prisma.solicitudTransporte.groupBy({
      by: ["estado"],
      where,
      _count: { _all: true },
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: rows.map(mapSolicitudTransporte),
    total,
    page,
    pageSize,
    kpis: Object.fromEntries(kpis.map((k) => [k.estado, k._count._all])),
  });
}

export async function POST(req: NextRequest) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  if (!puedeCrearSolicitudTransporte(actor.role)) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });

  const body = await req.json();
  const parsed = solicitudCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const fechaSolicitud = parseDateOnly(parsed.data.fechaSolicitud);
  const fechaPromesaEntrega = parseDateOnly(parsed.data.fechaPromesaEntrega);
  if (!fechaSolicitud) return NextResponse.json({ error: "Fecha de solicitud invalida" }, { status: 400 });

  const calculated = buildCalculatedFields({ fechaSolicitud, fechaPromesaEntrega });
  const row = await prisma.solicitudTransporte.create({
    data: {
      ...parsed.data,
      fechaSolicitud,
      fechaPromesaEntrega,
      valorFlete: parsed.data.valorFlete ?? null,
      prioridad: calculated.prioridad,
      semaforo: calculated.semaforo,
      mesSolicitud: calculated.mesSolicitud,
      creadoPorId: actor.id,
      historial: {
        create: {
          estadoAnterior: null,
          estadoNuevo: "PENDIENTE",
          observacion: "Solicitud creada",
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
    data: { userId: actor.id, action: "CREATE", module: "solicitudes-transporte", recordId: row.id, details: `Solicitud ${row.ciudadOrigen} -> ${row.ciudadEntrega}` },
  }).catch(() => {});
  await notifyGestores(row.id, actor.id, "Nueva solicitud de transporte", `${row.solicitanteNombre} solicito servicio hacia ${row.ciudadEntrega}`);

  return NextResponse.json({ success: true, data: mapSolicitudTransporte(row) }, { status: 201 });
}

export { buildCalculatedFields, estadoDesdeStella };
