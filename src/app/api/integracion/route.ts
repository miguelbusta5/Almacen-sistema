import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { canSeeModule } from "@/lib/modulePermissions";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

// Algunos call-sites (verificación de duplicado / creación) no incluyen
// `completadoPor` → relación opcional para que todos encajen sin `any`.
type IntegracionFull = Prisma.IntegracionPedidoGetPayload<{
  include: {
    creadoPor: { select: { name: true } };
    completadoPor: { select: { name: true } };
    plines: true;
  };
}>;
type IntegracionRow = Omit<IntegracionFull, "completadoPor"> &
  Partial<Pick<IntegracionFull, "completadoPor">>;

const ALLOWED_ROLES = ["OPERACIONES_MUEBLES", "OPERACIONES_GOURMET", "ADMIN", "GERENTE", "SUPERVISOR_TRANSPORTE", "TRANSPORTE"] as const;

function areaFromRole(role: string): "MUEBLES" | "GOURMET" | null {
  if (role === "OPERACIONES_MUEBLES") return "MUEBLES";
  if (role === "OPERACIONES_GOURMET") return "GOURMET";
  return null;
}

function mapRow(r: IntegracionRow) {
  return {
    id: r.id,
    numeroDocumento: r.numeroDocumento,
    tipoDocumento: r.tipoDocumento,
    fecha: r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : r.fecha,
    estado: r.estado,
    areaIniciadora: r.areaIniciadora,
    numeroCajasArea1: r.numeroCajasArea1,
    numeroCajasArea2: r.numeroCajasArea2,
    creadoPorId: r.creadoPorId,
    creadoPorNombre: r.creadoPor?.name ?? null,
    completadoPorNombre: r.completadoPor?.name ?? null,
    creadoAt: r.creadoAt,
    completadoAt: r.completadoAt,
    entregadoATransporteAt: r.entregadoATransporteAt,
    marcadoCompletadoAt: r.marcadoCompletadoAt,
    observaciones: r.observaciones,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    plines: r.plines ?? [],
  };
}

export async function GET(req: NextRequest) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  if (!canSeeModule(actor.role, "integracion")) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const estado = sp.get("estado") ?? undefined;
  const area = sp.get("area") ?? undefined;
  const tipoDocumento = sp.get("tipoDocumento") ?? undefined;
  const fechaDesde = sp.get("fechaDesde") ?? undefined;
  const fechaHasta = sp.get("fechaHasta") ?? undefined;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const pageSize = 50;

  const where: Record<string, unknown> = {};
  if (estado) where.estado = estado;
  if (area) where.areaIniciadora = area;
  if (tipoDocumento) where.tipoDocumento = tipoDocumento;
  if (fechaDesde || fechaHasta) {
    where.fecha = {
      ...(fechaDesde ? { gte: new Date(fechaDesde) } : {}),
      ...(fechaHasta ? { lte: new Date(fechaHasta) } : {}),
    };
  }

  const [total, rows] = await Promise.all([
    prisma.integracionPedido.count({ where }),
    prisma.integracionPedido.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        creadoPor: { select: { name: true } },
        completadoPor: { select: { name: true } },
        plines: true,
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: rows.map(mapRow),
    total,
    page,
    pageSize,
  });
}

const plinSchema = z.object({
  plu: z.string().min(1).max(100),
  descripcion: z.string().max(255).nullable().optional(),
  unidades: z.number().int().min(1),
});

const createSchema = z.object({
  numeroDocumento: z.string().min(1).max(100),
  tipoDocumento: z.enum(["OVDM", "TSDM"]),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  areaIniciadora: z.enum(["MUEBLES", "GOURMET"]).optional(),
  numeroCajas: z.number().int().min(1).nullable().optional(),
  plines: z.array(plinSchema).min(1),
  observaciones: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  if (!canSeeModule(actor.role, "integracion")) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }
  if (!(ALLOWED_ROLES as readonly string[]).includes(actor.role)) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const data = parsed.data;

  // Determine area iniciadora
  const areaFromActor = areaFromRole(actor.role);
  const areaIniciadora = areaFromActor ?? data.areaIniciadora;
  if (!areaIniciadora) {
    return NextResponse.json({ error: "Debe especificar areaIniciadora" }, { status: 400 });
  }
  const areaContraria = areaIniciadora === "MUEBLES" ? "GOURMET" : "MUEBLES";

  // Duplicate check
  const existing = await prisma.integracionPedido.findFirst({
    where: {
      numeroDocumento: data.numeroDocumento,
      estado: { in: ["PENDIENTE_AREA2", "LISTA_TRANSPORTE"] },
    },
    include: { creadoPor: { select: { name: true } }, plines: true },
  });

  if (existing) {
    if (existing.areaIniciadora === areaIniciadora) {
      return NextResponse.json(
        { error: "Ya existe una solicitud creada por su misma área para este documento", integracion: mapRow(existing) },
        { status: 409 }
      );
    }
    // Área contraria — informar para que completen
    return NextResponse.json(
      { exists: true, pendiente: true, integracion: mapRow(existing) },
      { status: 409 }
    );
  }

  // Create in transaction
  const integracion = await prisma.$transaction(async (tx) => {
    const rec = await tx.integracionPedido.create({
      data: {
        numeroDocumento: data.numeroDocumento,
        tipoDocumento: data.tipoDocumento,
        fecha: new Date(data.fecha),
        areaIniciadora,
        numeroCajasArea1: data.numeroCajas ?? null,
        creadoPorId: actor.id,
        observaciones: data.observaciones ?? null,
        plines: {
          create: data.plines.map((p) => ({
            area: areaIniciadora,
            plu: p.plu,
            descripcion: p.descripcion ?? null,
            unidades: p.unidades,
          })),
        },
      },
      include: { plines: true, creadoPor: { select: { name: true } } },
    });
    return rec;
  });

  // Notify area contraria + ADMIN + GERENTE
  const areaRol = areaContraria === "MUEBLES" ? "OPERACIONES_MUEBLES" : "OPERACIONES_GOURMET";
  const destinatarios = await prisma.user.findMany({
    where: {
      active: true,
      role: { in: [areaRol, "ADMIN", "GERENTE"] },
    },
    select: { id: true },
  });

  if (destinatarios.length > 0) {
    await prisma.notificacion.createMany({
      data: destinatarios.map((u) => ({
        userId: u.id,
        titulo: "Nueva integración de pedido",
        descripcion: `Área ${areaIniciadora} creó solicitud para ${data.tipoDocumento} ${data.numeroDocumento}`,
        tipo: "INTEGRACION",
        enlace: "/dashboard/integracion",
      })),
    });
  }

  prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: "CREATE",
      module: "integracion",
      recordId: integracion.id,
      details: `${data.tipoDocumento} ${data.numeroDocumento} — área ${areaIniciadora}`,
    },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: mapRow(integracion) }, { status: 201 });
}
