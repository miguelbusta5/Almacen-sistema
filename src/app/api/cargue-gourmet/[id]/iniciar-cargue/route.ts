import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { assertTransicionGourmet, type EstadoPedidoGourmet } from "@/lib/gourmetCargueFlow";
import type { GourmetPedido, GourmetCargue } from "@prisma/client";

const ROLES_PERMITIDOS = ["TRANSPORTE", "SUPERVISOR_TRANSPORTE", "OPERACIONES_GOURMET", "ADMIN", "GERENTE"] as const;
const ROLES_NOTIFICAR = ["ADMIN", "GERENTE"] as const;

const bodySchema = z.object({
  updatedAt: z.string().datetime(),
});

function mapPedido(r: GourmetPedido) {
  return {
    id: r.id,
    orden: r.orden,
    tipoOrden: r.tipoOrden,
    codigoTienda: r.codigoTienda,
    nombreTienda: r.nombreTienda,
    ciudadDestino: r.ciudadDestino,
    cajasEsperadas: r.cajasEsperadas,
    estibasEsperadas: r.estibasEsperadas,
    estado: r.estado,
    updatedAt: r.updatedAt,
    cargueIniciadoAt: r.cargueIniciadoAt,
    cargueIniciadoPorId: r.cargueIniciadoPorId,
  };
}

function mapCargue(c: GourmetCargue) {
  return {
    id: c.id,
    pedidoId: c.pedidoId,
    iniciadoPorId: c.iniciadoPorId,
    iniciadoAt: c.iniciadoAt,
    cantidadEsperada: c.cantidadEsperada,
    cantidadEscaneada: c.cantidadEscaneada,
    estado: c.estado,
  };
}

// POST /api/cargue-gourmet/[id]/iniciar-cargue
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireRole([...ROLES_PERMITIDOS]);
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  const current = await prisma.gourmetPedido.findUnique({
    where: { id },
    select: {
      estado: true,
      updatedAt: true,
      orden: true,
      ciudadDestino: true,
      cajasEsperadas: true,
      estibasEsperadas: true,
      creadoPorId: true,
      _count: { select: { estibas: true } },
    },
  });
  if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const destino: EstadoPedidoGourmet = "EN_CARGUE";
  const origen = current.estado as EstadoPedidoGourmet;
  const check = assertTransicionGourmet(origen, destino, actor.role);
  if (!check.ok) {
    const status = check.motivo === "SIN_PERMISO" ? 403 : 409;
    return NextResponse.json({ error: check.mensaje, code: check.motivo }, { status });
  }

  if (new Date(d.updatedAt).getTime() !== current.updatedAt.getTime()) {
    return NextResponse.json(
      { error: "Conflicto: el pedido fue modificado por otro usuario", code: "CONFLICT" },
      { status: 409 }
    );
  }

  if (current._count.estibas < 1) {
    return NextResponse.json(
      { error: "El pedido no tiene estibas registradas — no se puede iniciar el cargue" },
      { status: 409 }
    );
  }
  if (current.cajasEsperadas <= 0) {
    return NextResponse.json({ error: "cajasEsperadas debe ser mayor a 0" }, { status: 409 });
  }
  if (current.estibasEsperadas <= 0) {
    return NextResponse.json({ error: "estibasEsperadas debe ser mayor a 0" }, { status: 409 });
  }

  const cargueActivo = await prisma.gourmetCargue.findFirst({
    where: { pedidoId: id, estado: "EN_CARGUE" },
    select: { id: true },
  });
  if (cargueActivo) {
    return NextResponse.json(
      { error: "Ya existe un cargue activo para este pedido", code: "CARGUE_ACTIVO_EXISTENTE" },
      { status: 409 }
    );
  }

  const { pedido, cargue } = await prisma.$transaction(async (tx) => {
    const nuevoCargue = await tx.gourmetCargue.create({
      data: {
        pedidoId: id,
        iniciadoPorId: actor.id,
        cantidadEsperada: current.cajasEsperadas,
        cantidadEscaneada: 0,
        estado: "EN_CARGUE",
      },
    });

    const pedidoActualizado = await tx.gourmetPedido.update({
      where: { id },
      data: {
        estado: "EN_CARGUE",
        cargueIniciadoAt: new Date(),
        cargueIniciadoPorId: actor.id,
      },
    });

    return { pedido: pedidoActualizado, cargue: nuevoCargue };
  });

  // El creador del pedido ya es conocido (pedido.creadoPorId) — no requiere
  // búsqueda adicional ("destinatario identificable de forma simple").
  const destinatariosIds = new Set<string>();
  if (current.creadoPorId) destinatariosIds.add(current.creadoPorId);
  const adminsGerentes = await prisma.user.findMany({
    where: { active: true, role: { in: [...ROLES_NOTIFICAR] } },
    select: { id: true },
  });
  adminsGerentes.forEach((u) => destinatariosIds.add(u.id));

  if (destinatariosIds.size > 0) {
    prisma.notificacion.createMany({
      data: Array.from(destinatariosIds).map((userId) => ({
        userId,
        titulo: "Cargue Gourmet iniciado",
        descripcion: `${pedido.tipoOrden} ${pedido.orden} — destino ${pedido.ciudadDestino}`,
        tipo: "CARGUE_GOURMET",
        enlace: "/dashboard/cargue-gourmet",
      })),
    }).catch(() => {});
  }

  prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: "UPDATE",
      module: "cargue-gourmet",
      recordId: pedido.id,
      details: `Cargue iniciado — ${pedido.tipoOrden} ${pedido.orden}`,
    },
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    data: { pedido: mapPedido(pedido), cargue: mapCargue(cargue) },
  });
}
