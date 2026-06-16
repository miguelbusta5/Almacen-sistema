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
  validarFlete,
  validarPlinesSolicitudTransporte,
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
  solicitanteTelefono: z.string().min(1).max(40),
  tipoVenta: z.string().min(1).max(40),
  numeroPedido: z.string().min(1).max(120),
  facturaIntegracion: z.string().max(120).optional().nullable(),
  cobroFlete: z.boolean(),
  valorFlete: z.number().nonnegative().optional().nullable(),
  cantidadCajas: z.number().int().min(1).optional(),
  unidades: z.number().int().min(1).optional().nullable(),
  volumenEstimado: z.string().min(1).max(30),
  tipoMercancia: z.string().min(1).max(40),
  ciudadOrigen: z.string().min(2).max(80),
  zonaRecogida: z.string().min(1).max(20),
  direccionRecogida: z.string().min(3),
  puntoRecogida: z.string().min(1).max(255),
  puntoRecogidaOtro: z.string().max(255).optional().nullable(),
  ciudadEntrega: z.string().min(2).max(80),
  direccionEntrega: z.string().min(5),
  zonaEntrega: z.string().min(1).max(20),
  fechaPromesaEntrega: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ventanaEntrega: z.string().min(1).max(40),
  restriccionHoraria: z.boolean(),
  descripcionRestriccion: z.string().optional().nullable(),
  tipoServicio: z.string().min(1).max(80),
  tipoServicioOtro: z.string().max(120).optional().nullable(),
  observacionesSolicitante: z.string().min(1),
  plines: z.array(z.object({
    plu: z.string().min(1).max(100),
    descripcion: z.string().min(1).max(255),
    unidades: z.number().int().min(1),
  })).min(1),
}).superRefine((data, ctx) => {
  const cantidadCajas = data.cantidadCajas ?? data.unidades ?? null;
  if (!cantidadCajas) {
    ctx.addIssue({ code: "custom", path: ["cantidadCajas"], message: "Cantidad cajas es obligatoria" });
  }
  const fleteError = validarFlete(data.cobroFlete, data.valorFlete ?? null);
  if (fleteError) ctx.addIssue({ code: "custom", path: ["valorFlete"], message: fleteError });
  const plinesError = validarPlinesSolicitudTransporte(data.plines);
  if (plinesError) ctx.addIssue({ code: "custom", path: ["plines"], message: plinesError });
  if (data.areaSolicitante === "Otro" && !data.areaOtro?.trim()) {
    ctx.addIssue({ code: "custom", path: ["areaOtro"], message: "Debes indicar el area" });
  }
  if (data.puntoRecogida === "Otros" && !data.puntoRecogidaOtro?.trim()) {
    ctx.addIssue({ code: "custom", path: ["puntoRecogidaOtro"], message: "Debes indicar el punto de recogida" });
  }
  if (data.tipoServicio === "Otro" && !data.tipoServicioOtro?.trim()) {
    ctx.addIssue({ code: "custom", path: ["tipoServicioOtro"], message: "Debes indicar el tipo de servicio" });
  }
  if (data.restriccionHoraria && !data.descripcionRestriccion?.trim()) {
    ctx.addIssue({ code: "custom", path: ["descripcionRestriccion"], message: "Debes describir la restriccion horaria" });
  }
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
    cantidadCajas: row.unidades,
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
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    plines: row.plines ?? [],
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
    deletedAt: null,
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
        plines: true,
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
  if (!fechaPromesaEntrega) return NextResponse.json({ error: "Fecha promesa invalida" }, { status: 400 });

  const calculated = buildCalculatedFields({ fechaSolicitud, fechaPromesaEntrega });
  const cantidadCajas = parsed.data.cantidadCajas ?? parsed.data.unidades!;
  const row = await prisma.solicitudTransporte.create({
    data: {
      fechaSolicitud,
      areaSolicitante: parsed.data.areaSolicitante,
      areaOtro: parsed.data.areaOtro || null,
      solicitanteNombre: parsed.data.solicitanteNombre,
      solicitanteCorreo: parsed.data.solicitanteCorreo,
      solicitanteTelefono: parsed.data.solicitanteTelefono,
      tipoVenta: parsed.data.tipoVenta,
      numeroPedido: parsed.data.numeroPedido,
      facturaIntegracion: parsed.data.facturaIntegracion,
      cobroFlete: parsed.data.cobroFlete,
      valorFlete: parsed.data.cobroFlete ? parsed.data.valorFlete ?? null : null,
      unidades: cantidadCajas,
      volumenEstimado: parsed.data.volumenEstimado,
      tipoMercancia: parsed.data.tipoMercancia,
      ciudadOrigen: parsed.data.ciudadOrigen,
      zonaRecogida: parsed.data.zonaRecogida,
      direccionRecogida: parsed.data.direccionRecogida,
      puntoRecogida: parsed.data.puntoRecogida,
      puntoRecogidaOtro: parsed.data.puntoRecogidaOtro || null,
      ciudadEntrega: parsed.data.ciudadEntrega,
      direccionEntrega: parsed.data.direccionEntrega,
      zonaEntrega: parsed.data.zonaEntrega,
      fechaPromesaEntrega,
      ventanaEntrega: parsed.data.ventanaEntrega,
      restriccionHoraria: parsed.data.restriccionHoraria,
      descripcionRestriccion: parsed.data.descripcionRestriccion || null,
      tipoServicio: parsed.data.tipoServicio,
      tipoServicioOtro: parsed.data.tipoServicioOtro || null,
      observacionesSolicitante: parsed.data.observacionesSolicitante,
      prioridad: calculated.prioridad,
      semaforo: calculated.semaforo,
      mesSolicitud: calculated.mesSolicitud,
      creadoPorId: actor.id,
      plines: {
        create: parsed.data.plines.map((p) => ({
          plu: p.plu.trim().toUpperCase(),
          descripcion: p.descripcion.trim(),
          unidades: p.unidades,
        })),
      },
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
      plines: true,
    },
  });

  await prisma.activityLog.create({
    data: { userId: actor.id, action: "CREATE", module: "solicitudes-transporte", recordId: row.id, details: `Solicitud ${row.ciudadOrigen} -> ${row.ciudadEntrega}` },
  }).catch(() => {});
  await notifyGestores(row.id, actor.id, "Nueva solicitud de transporte", `${row.solicitanteNombre} solicito servicio hacia ${row.ciudadEntrega}`);

  return NextResponse.json({ success: true, data: mapSolicitudTransporte(row) }, { status: 201 });
}

export { buildCalculatedFields, estadoDesdeStella };
