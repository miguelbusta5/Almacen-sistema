import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { EstadoPedidoGourmet } from "@/lib/gourmetCargueFlow";
import type { GourmetPedido } from "@prisma/client";

const ROLES_PERMITIDOS = ["ADMIN", "GERENTE"] as const;
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
    estado: r.estado,
    updatedAt: r.updatedAt,
    cargueIniciadoAt: r.cargueIniciadoAt,
    cargueIniciadoPorId: r.cargueIniciadoPorId,
  };
}

// POST /api/cargue-gourmet/[id]/revertir-cargue
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
      tipoOrden: true,
      estado: true,
      updatedAt: true,
      ciudadDestino: true,
      enviadoTransporteAt: true,
      creadoPorId: true,
    },
  });
  if (!pedido) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // No se reutiliza la máquina de estados genérica (assertTransicionGourmet):
  // esta es una acción de supervisión excepcional (revertir, no avanzar el
  // flujo normal) y ya está restringida a ADMIN/GERENTE por requireRole. Un
  // destino compartido con otros endpoints (ej. UBICACION_ASIGNADA, que usa
  // /ubicacion) causaría que ese otro endpoint también aceptara la transición
  // EN_CARGUE → UBICACION_ASIGNADA sin limpiar el GourmetCargue activo.
  if (pedido.estado !== "EN_CARGUE") {
    return NextResponse.json(
      { error: `No se puede revertir: el pedido está en estado ${pedido.estado}`, code: "ESTADO_INVALIDO" },
      { status: 409 }
    );
  }

  // Vuelve al estado predecesor real: si el pedido pasó por
  // ENVIADO_A_TRANSPORTE (flujo heredado), regresa ahí; si no, a
  // UBICACION_ASIGNADA (flujo actual, el cargue arranca directo desde ahí).
  const destino: EstadoPedidoGourmet = pedido.enviadoTransporteAt ? "ENVIADO_A_TRANSPORTE" : "UBICACION_ASIGNADA";

  if (new Date(d.updatedAt).getTime() !== pedido.updatedAt.getTime()) {
    return NextResponse.json(
      { error: "Conflicto: el pedido fue modificado por otro usuario", code: "CONFLICT" },
      { status: 409 }
    );
  }

  const cargue = await prisma.gourmetCargue.findFirst({
    where: { pedidoId: id, estado: "EN_CARGUE" },
  });
  if (!cargue) {
    return NextResponse.json({ error: "No hay un cargue activo para revertir" }, { status: 409 });
  }

  const pedidoActualizado = await prisma.$transaction(async (tx) => {
    // Cascada automática sobre escaneos/novedades del cargue (onDelete: Cascade).
    await tx.gourmetCargue.delete({ where: { id: cargue.id } });

    return tx.gourmetPedido.update({
      where: { id },
      data: {
        estado: destino,
        cargueIniciadoAt: null,
        cargueIniciadoPorId: null,
      },
    });
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
        titulo: "Cargue Gourmet revertido",
        descripcion: `${pedidoActualizado.tipoOrden} ${pedidoActualizado.orden} — destino ${pedidoActualizado.ciudadDestino}`,
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
      details: `Cargue revertido — ${pedido.tipoOrden} ${pedido.orden} vuelve a ${destino}`,
    },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: { pedido: mapPedido(pedidoActualizado) } });
}
