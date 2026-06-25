import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { assertTransicionGourmet, type EstadoPedidoGourmet } from "@/lib/gourmetCargueFlow";

const ROLES_PERMITIDOS = ["TRANSPORTE", "SUPERVISOR_TRANSPORTE", "ADMIN", "GERENTE"] as const;
const ROLES_NOTIFICAR = ["ADMIN", "GERENTE"] as const;

const bodySchema = z.object({
  updatedAt: z.string().datetime(),
});

function mapPedido(r: any) {
  return {
    id: r.id,
    orden: r.orden,
    tipoOrden: r.tipoOrden,
    codigoTienda: r.codigoTienda,
    nombreTienda: r.nombreTienda,
    ciudadDestino: r.ciudadDestino,
    estado: r.estado,
    updatedAt: r.updatedAt,
    cargueCompletadoAt: r.cargueCompletadoAt,
    cargueCompletadoPorId: r.cargueCompletadoPorId,
  };
}

function mapCargue(c: any) {
  return {
    id: c.id,
    pedidoId: c.pedidoId,
    estado: c.estado,
    tipoCierre: c.tipoCierre,
    cantidadEsperada: c.cantidadEsperada,
    cantidadEscaneada: c.cantidadEscaneada,
    finalizadoAt: c.finalizadoAt,
    finalizadoPorId: c.finalizadoPorId,
  };
}

// POST /api/cargue-gourmet/[id]/finalizar
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

  const pedido = await prisma.gourmetPedido.findUnique({
    where: { id },
    select: {
      id: true,
      orden: true,
      estado: true,
      updatedAt: true,
      ciudadDestino: true,
      creadoPorId: true,
    },
  });
  if (!pedido) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const destino: EstadoPedidoGourmet = "CARGUE_COMPLETO";
  const origen = pedido.estado as EstadoPedidoGourmet;
  const check = assertTransicionGourmet(origen, destino, actor.role);
  if (!check.ok) {
    const status = check.motivo === "SIN_PERMISO" ? 403 : 409;
    return NextResponse.json({ error: check.mensaje, code: check.motivo }, { status });
  }

  const cargue = await prisma.gourmetCargue.findFirst({
    where: { pedidoId: id, estado: "EN_CARGUE" },
  });
  if (!cargue) {
    return NextResponse.json({ error: "No hay un cargue activo para este pedido" }, { status: 409 });
  }

  if (new Date(d.updatedAt).getTime() !== pedido.updatedAt.getTime()) {
    return NextResponse.json(
      { error: "Conflicto: el pedido fue modificado por otro usuario", code: "CONFLICT" },
      { status: 409 }
    );
  }

  if (cargue.cantidadEscaneada !== cargue.cantidadEsperada) {
    return NextResponse.json(
      {
        error: `Cajas escaneadas (${cargue.cantidadEscaneada}) no coinciden con las esperadas (${cargue.cantidadEsperada})`,
        code: "CANTIDAD_NO_COINCIDE",
      },
      { status: 409 }
    );
  }

  const novedadAbierta = await prisma.gourmetCargueNovedad.findFirst({
    where: { cargueId: cargue.id, estado: "ABIERTA" },
    select: { id: true },
  });
  if (novedadAbierta) {
    return NextResponse.json(
      { error: "Hay novedades abiertas — resuélvelas antes de finalizar el cargue", code: "NOVEDAD_ABIERTA" },
      { status: 409 }
    );
  }

  const { pedido: pedidoActualizado, cargue: cargueActualizado } = await prisma.$transaction(async (tx) => {
    const cargueFinal = await tx.gourmetCargue.update({
      where: { id: cargue.id },
      data: {
        estado: "CARGUE_COMPLETO",
        finalizadoAt: new Date(),
        finalizadoPorId: actor.id,
        tipoCierre: "NORMAL",
      },
    });

    const pedidoFinal = await tx.gourmetPedido.update({
      where: { id },
      data: {
        estado: "CARGUE_COMPLETO",
        cargueCompletadoAt: new Date(),
        cargueCompletadoPorId: actor.id,
      },
    });

    return { pedido: pedidoFinal, cargue: cargueFinal };
  });

  const destinatariosIds = new Set<string>();
  if (pedido.creadoPorId) destinatariosIds.add(pedido.creadoPorId);
  const adminsGerentes = await prisma.user.findMany({
    where: { active: true, role: { in: [...ROLES_NOTIFICAR] } },
    select: { id: true },
  });
  adminsGerentes.forEach((u) => destinatariosIds.add(u.id));

  if (destinatariosIds.size > 0) {
    prisma.notificacion.createMany({
      data: Array.from(destinatariosIds).map((userId) => ({
        userId,
        titulo: "Cargue Gourmet finalizado",
        descripcion: `${pedidoActualizado.orden} — destino ${pedidoActualizado.ciudadDestino}`,
        tipo: "CARGUE_GOURMET",
        enlace: "/dashboard/cargue-gourmet",
      })),
    }).catch(() => {});
  }

  return NextResponse.json({
    success: true,
    data: { pedido: mapPedido(pedidoActualizado), cargue: mapCargue(cargueActualizado) },
  });
}
