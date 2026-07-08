import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireCan } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { canSeeModule } from "@/lib/modulePermissions";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

type IntegracionFull = Prisma.IntegracionPedidoGetPayload<{
  include: {
    creadoPor: { select: { name: true } };
    completadoPor: { select: { name: true } };
    plines: true;
  };
}>;
type IntegracionRow = Omit<IntegracionFull, "completadoPor"> &
  Partial<Pick<IntegracionFull, "completadoPor">>;

const TRANSPORT_ROLES = ["SUPERVISOR_TRANSPORTE", "TRANSPORTE", "ADMIN", "GERENTE"] as const;

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
    marcadoCompletadoPorId: r.marcadoCompletadoPorId,
    marcadoCompletadoAt: r.marcadoCompletadoAt,
    observaciones: r.observaciones,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    plines: r.plines ?? [],
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  if (!canSeeModule(actor.role, "integracion")) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const { id } = await params;
  const rec = await prisma.integracionPedido.findUnique({
    where: { id },
    include: {
      creadoPor: { select: { name: true } },
      completadoPor: { select: { name: true } },
      plines: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!rec) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ success: true, data: mapRow(rec) });
}

const plinSchema = z.object({
  plu: z.string().min(1).max(100),
  descripcion: z.string().max(255).nullable().optional(),
  unidades: z.number().int().min(1),
});

const completarArea2Schema = z.object({
  accion: z.literal("COMPLETAR_AREA2"),
  numeroCajasArea2: z.number().int().min(1).nullable().optional(),
  plines: z.array(plinSchema).min(1),
  observaciones: z.string().nullable().optional(),
});

const marcarCompletadaSchema = z.object({
  accion: z.literal("MARCAR_COMPLETADA"),
  observaciones: z.string().nullable().optional(),
});

const editarSchema = z.object({
  accion: z.literal("EDITAR"),
  numeroDocumento: z.string().min(1).max(100),
  tipoDocumento: z.enum(["OVDM", "TSDM"]),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  numeroCajasArea1: z.number().int().min(1).nullable().optional(),
  numeroCajasArea2: z.number().int().min(1).nullable().optional(),
  observaciones: z.string().nullable().optional(),
  plines: z.array(plinSchema.extend({ area: z.enum(["MUEBLES", "GOURMET"]) })),
});

const putSchema = z.discriminatedUnion("accion", [completarArea2Schema, marcarCompletadaSchema, editarSchema]);

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  if (!canSeeModule(actor.role, "integracion")) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const rec = await prisma.integracionPedido.findUnique({
    where: { id },
    include: { plines: true },
  });
  if (!rec) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // ── COMPLETAR_AREA2 ──────────────────────────────────────────────
  if (parsed.data.accion === "COMPLETAR_AREA2") {
    if (rec.estado !== "PENDIENTE_AREA2") {
      return NextResponse.json({ error: "Solo se puede completar cuando el estado es PENDIENTE_AREA2" }, { status: 409 });
    }

    const areaContraria = rec.areaIniciadora === "MUEBLES" ? "GOURMET" : "MUEBLES";
    const actorArea = areaFromRole(actor.role);

    // ADMIN/GERENTE pueden completar desde cualquier área; operarios del área contraria
    if (actorArea !== null && actorArea !== areaContraria) {
      return NextResponse.json({ error: "Solo el área contraria a la iniciadora puede completar" }, { status: 403 });
    }
    const areaUsada = actorArea ?? areaContraria;

    const area2Data = parsed.data as { accion: "COMPLETAR_AREA2"; plines: { plu: string; descripcion?: string | null; unidades: number }[]; numeroCajasArea2?: number | null; observaciones?: string | null };
    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      await tx.plinIntegracion.createMany({
        data: area2Data.plines.map((p) => ({
          integracionId: id,
          area: areaUsada,
          plu: p.plu,
          descripcion: p.descripcion ?? null,
          unidades: p.unidades,
        })),
      });
      return tx.integracionPedido.update({
        where: { id },
        data: {
          estado: "LISTA_TRANSPORTE",
          numeroCajasArea2: area2Data.numeroCajasArea2 ?? null,
          completadoPorId: actor.id,
          completadoAt: now,
          entregadoATransporteAt: now,
          observaciones: area2Data.observaciones ?? rec.observaciones,
        },
        include: {
          plines: true,
          creadoPor: { select: { name: true } },
          completadoPor: { select: { name: true } },
        },
      });
    });

    // Notify transport + ADMIN + GERENTE
    const destinatarios = await prisma.user.findMany({
      where: { active: true, role: { in: ["SUPERVISOR_TRANSPORTE", "TRANSPORTE", "ADMIN", "GERENTE"] } },
      select: { id: true },
    });
    if (destinatarios.length > 0) {
      await prisma.notificacion.createMany({
        data: destinatarios.map((u) => ({
          userId: u.id,
          titulo: "Integración lista para transporte",
          descripcion: `${rec.tipoDocumento} ${rec.numeroDocumento} — Área 2 completó su picking`,
          tipo: "INTEGRACION",
          enlace: "/dashboard/integracion",
        })),
      });
    }

    prisma.activityLog.create({
      data: {
        userId: actor.id,
        action: "COMPLETE_AREA2",
        module: "integracion",
        recordId: id,
        details: `${rec.tipoDocumento} ${rec.numeroDocumento}`,
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, data: mapRow(updated) });
  }

  // ── MARCAR_COMPLETADA ──────────────────────────────────────────────
  if (parsed.data.accion === "MARCAR_COMPLETADA") {
    if (rec.estado !== "LISTA_TRANSPORTE") {
      return NextResponse.json({ error: "Solo se puede marcar completada cuando el estado es LISTA_TRANSPORTE" }, { status: 409 });
    }
    if (!(TRANSPORT_ROLES as readonly string[]).includes(actor.role)) {
      return NextResponse.json({ error: "Solo transporte puede marcar como completada" }, { status: 403 });
    }

    const updated = await prisma.integracionPedido.update({
      where: { id },
      data: {
        estado: "COMPLETADA",
        marcadoCompletadoPorId: actor.id,
        marcadoCompletadoAt: new Date(),
        observaciones: parsed.data.observaciones ?? rec.observaciones,
      },
      include: {
        plines: true,
        creadoPor: { select: { name: true } },
        completadoPor: { select: { name: true } },
      },
    });

    prisma.activityLog.create({
      data: {
        userId: actor.id,
        action: "MARK_COMPLETE",
        module: "integracion",
        recordId: id,
        details: `${rec.tipoDocumento} ${rec.numeroDocumento}`,
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, data: mapRow(updated) });
  }

  // ── EDITAR ───────────────────────────────────────────────────────
  if (parsed.data.accion === "EDITAR") {
    if (!(["ADMIN", "GERENTE"] as readonly string[]).includes(actor.role)) {
      return NextResponse.json({ error: "Solo ADMIN o GERENTE pueden editar una integración" }, { status: 403 });
    }
    if (rec.estado === "COMPLETADA") {
      return NextResponse.json({ error: "No se puede editar una integración completada" }, { status: 409 });
    }

    const d = parsed.data;

    if (d.numeroDocumento !== rec.numeroDocumento || d.tipoDocumento !== rec.tipoDocumento) {
      const duplicado = await prisma.integracionPedido.findFirst({
        where: {
          id: { not: id },
          numeroDocumento: d.numeroDocumento,
          estado: { in: ["PENDIENTE_AREA2", "LISTA_TRANSPORTE"] },
        },
      });
      if (duplicado) {
        return NextResponse.json({ error: "Ya existe otra integración activa con este número de documento" }, { status: 409 });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.plinIntegracion.deleteMany({ where: { integracionId: id } });
      if (d.plines.length > 0) {
        await tx.plinIntegracion.createMany({
          data: d.plines.map((p) => ({
            integracionId: id,
            area: p.area,
            plu: p.plu,
            descripcion: p.descripcion ?? null,
            unidades: p.unidades,
          })),
        });
      }
      return tx.integracionPedido.update({
        where: { id },
        data: {
          numeroDocumento: d.numeroDocumento,
          tipoDocumento: d.tipoDocumento,
          fecha: new Date(d.fecha),
          numeroCajasArea1: d.numeroCajasArea1 ?? null,
          numeroCajasArea2: d.numeroCajasArea2 ?? null,
          observaciones: d.observaciones ?? null,
        },
        include: {
          plines: true,
          creadoPor: { select: { name: true } },
          completadoPor: { select: { name: true } },
        },
      });
    });

    prisma.activityLog.create({
      data: {
        userId: actor.id,
        action: "EDIT",
        module: "integracion",
        recordId: id,
        details: `${updated.tipoDocumento} ${updated.numeroDocumento}`,
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, data: mapRow(updated) });
  }

  return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await requireCan("delete");
  if (actor instanceof NextResponse) return actor;

  const { id } = await params;

  await prisma.integracionPedido.delete({ where: { id } }).catch(() => {});

  prisma.activityLog.create({
    data: { userId: actor.id, action: "DELETE", module: "integracion", recordId: id },
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
