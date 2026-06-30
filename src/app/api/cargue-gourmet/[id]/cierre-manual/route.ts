import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { assertTransicionGourmet, type EstadoPedidoGourmet } from "@/lib/gourmetCargueFlow";
import type { GourmetPedido, GourmetCargue, GourmetCargueNovedad } from "@prisma/client";

const ROLES_PERMITIDOS = ["SUPERVISOR_TRANSPORTE", "OPERACIONES_GOURMET", "ADMIN", "GERENTE"] as const;
const ROLES_NOTIFICAR = ["ADMIN", "GERENTE"] as const;

// Estados de cargue desde los que se acepta un cierre manual de contingencia.
const ESTADOS_CARGUE_CERRABLES = ["EN_CARGUE", "CON_NOVEDAD"] as const;

const bodySchema = z.object({
  cantidadContadaManual: z.number().int().min(0),
  motivo: z.string().min(5),
  observacion: z.string().optional(),
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
    estado: r.estado,
    updatedAt: r.updatedAt,
    esCierreManual: r.esCierreManual,
    cantidadContadaManual: r.cantidadContadaManual,
    motivoCierreManual: r.motivoCierreManual,
    observacionCierreManual: r.observacionCierreManual,
    cargueCompletadoAt: r.cargueCompletadoAt,
    cargueCompletadoPorId: r.cargueCompletadoPorId,
  };
}

function mapCargue(c: GourmetCargue) {
  return {
    id: c.id,
    pedidoId: c.pedidoId,
    estado: c.estado,
    tipoCierre: c.tipoCierre,
    cantidadEsperada: c.cantidadEsperada,
    cantidadEscaneada: c.cantidadEscaneada,
    cantidadContadaManual: c.cantidadContadaManual,
    motivoCierreManual: c.motivoCierreManual,
    observacion: c.observacion,
    finalizadoAt: c.finalizadoAt,
    finalizadoPorId: c.finalizadoPorId,
  };
}

function mapNovedad(n: GourmetCargueNovedad) {
  return {
    id: n.id,
    cargueId: n.cargueId,
    pedidoId: n.pedidoId,
    tipo: n.tipo,
    descripcion: n.descripcion,
    estado: n.estado,
    registradaPorId: n.registradaPorId,
    resueltaPorId: n.resueltaPorId,
    resueltaAt: n.resueltaAt,
  };
}

// POST /api/cargue-gourmet/[id]/cierre-manual
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

  const destino: EstadoPedidoGourmet = "CARGUE_COMPLETO_MANUAL";
  const origen = pedido.estado as EstadoPedidoGourmet;
  const check = assertTransicionGourmet(origen, destino, actor.role);
  if (!check.ok) {
    const status = check.motivo === "SIN_PERMISO" ? 403 : 409;
    return NextResponse.json({ error: check.mensaje, code: check.motivo }, { status });
  }

  const cargue = await prisma.gourmetCargue.findFirst({
    where: { pedidoId: id, estado: { in: [...ESTADOS_CARGUE_CERRABLES] } },
  });
  if (!cargue) {
    return NextResponse.json({ error: "No hay un cargue válido para cerrar manualmente" }, { status: 409 });
  }

  if (new Date(d.updatedAt).getTime() !== pedido.updatedAt.getTime()) {
    return NextResponse.json(
      { error: "Conflicto: el pedido fue modificado por otro usuario", code: "CONFLICT" },
      { status: 409 }
    );
  }

  const descripcion =
    `Cierre manual — esperadas: ${cargue.cantidadEsperada}, escaneadas: ${cargue.cantidadEscaneada}, ` +
    `contadas manualmente: ${d.cantidadContadaManual}. Motivo: ${d.motivo}.` +
    (d.observacion ? ` Observación: ${d.observacion}.` : "");

  const { pedido: pedidoActualizado, cargue: cargueActualizado, novedad } = await prisma.$transaction(
    async (tx) => {
      const novedadCreada = await tx.gourmetCargueNovedad.create({
        data: {
          cargueId: cargue.id,
          pedidoId: id,
          tipo: "CIERRE_MANUAL",
          descripcion,
          estado: "RESUELTA",
          registradaPorId: actor.id,
          resueltaPorId: actor.id,
          resueltaAt: new Date(),
        },
      });

      const cargueFinal = await tx.gourmetCargue.update({
        where: { id: cargue.id },
        data: {
          estado: "CARGUE_COMPLETO_MANUAL",
          finalizadoAt: new Date(),
          finalizadoPorId: actor.id,
          tipoCierre: "MANUAL",
          cantidadContadaManual: d.cantidadContadaManual,
          motivoCierreManual: d.motivo,
          observacion: d.observacion ?? null,
        },
      });

      const pedidoFinal = await tx.gourmetPedido.update({
        where: { id },
        data: {
          estado: "CARGUE_COMPLETO_MANUAL",
          cargueCompletadoAt: new Date(),
          cargueCompletadoPorId: actor.id,
          esCierreManual: true,
          cantidadContadaManual: d.cantidadContadaManual,
          motivoCierreManual: d.motivo,
          observacionCierreManual: d.observacion ?? null,
        },
      });

      return { pedido: pedidoFinal, cargue: cargueFinal, novedad: novedadCreada };
    }
  );

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
        titulo: "Cargue Gourmet cerrado manualmente",
        descripcion: `${pedidoActualizado.orden} — destino ${pedidoActualizado.ciudadDestino}. Motivo: ${d.motivo}`,
        tipo: "CARGUE_GOURMET",
        enlace: "/dashboard/cargue-gourmet",
      })),
    }).catch(() => {});
  }

  return NextResponse.json({
    success: true,
    data: {
      pedido: mapPedido(pedidoActualizado),
      cargue: mapCargue(cargueActualizado),
      novedad: mapNovedad(novedad),
    },
  });
}
