import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { assertTransicionGourmet, type EstadoPedidoGourmet } from "@/lib/gourmetCargueFlow";

const ROLES_PERMITIDOS = ["OPERACIONES_GOURMET", "ADMIN", "GERENTE"] as const;
const ROLES_NOTIFICAR = ["TRANSPORTE", "SUPERVISOR_TRANSPORTE", "ADMIN", "GERENTE"] as const;

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
    cajasEsperadas: r.cajasEsperadas,
    estibasEsperadas: r.estibasEsperadas,
    estado: r.estado,
    updatedAt: r.updatedAt,
    enviadoTransporteAt: r.enviadoTransporteAt,
    enviadoTransportePorId: r.enviadoTransportePorId,
  };
}

// POST /api/cargue-gourmet/[id]/enviar-transporte
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
      _count: { select: { estibas: true } },
    },
  });
  if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const destino: EstadoPedidoGourmet = "ENVIADO_A_TRANSPORTE";
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
      { error: "El pedido no tiene estibas registradas — asigna ubicación antes de enviar a Transporte" },
      { status: 409 }
    );
  }
  if (current.cajasEsperadas <= 0) {
    return NextResponse.json({ error: "cajasEsperadas debe ser mayor a 0" }, { status: 409 });
  }
  if (current.estibasEsperadas <= 0) {
    return NextResponse.json({ error: "estibasEsperadas debe ser mayor a 0" }, { status: 409 });
  }

  const pedido = await prisma.gourmetPedido.update({
    where: { id },
    data: {
      estado: "ENVIADO_A_TRANSPORTE",
      enviadoTransporteAt: new Date(),
      enviadoTransportePorId: actor.id,
    },
  });

  const destinatarios = await prisma.user.findMany({
    where: { active: true, role: { in: [...ROLES_NOTIFICAR] } },
    select: { id: true },
  });
  if (destinatarios.length > 0) {
    prisma.notificacion.createMany({
      data: destinatarios.map((u) => ({
        userId: u.id,
        titulo: "Pedido Gourmet enviado a Transporte",
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
      details: `Enviado a Transporte — ${pedido.tipoOrden} ${pedido.orden}`,
    },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: mapPedido(pedido) });
}
