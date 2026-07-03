import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { EstadoPedidoGourmet } from "@/lib/gourmetCargueFlow";
import { ESTADOS_TERMINALES_GOURMET } from "@/lib/gourmetCargueFlow";

const ROLES_NOTIFICAR = ["ADMIN", "GERENTE"] as const;

// Despacho masivo: bypass deliberado del flujo normal de cargue/escaneo de
// cajas — cierra de una vez varios pedidos sin verificación física. Por eso
// NO se apoya en `assertTransicionGourmet` (esa matriz es para el flujo
// operativo normal) y se restringe a ADMIN + un único usuario nombrado
// (Diego Zapata, auxiliar de transporte), no a un rol completo.
const EMAIL_AUTORIZADO = "auxiliar-transporte@gmail.com";
const MOTIVO_DESPACHO_MASIVO = "DESPACHO_MASIVO";

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
});

// POST /api/cargue-gourmet/despacho-masivo
export async function POST(req: NextRequest) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;

  const autorizado = actor.role === "ADMIN" || actor.email.toLowerCase() === EMAIL_AUTORIZADO;
  if (!autorizado) {
    return NextResponse.json({ error: "No tienes permisos para realizar esta acción" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const ids = Array.from(new Set(parsed.data.ids));

  const pedidos = await prisma.gourmetPedido.findMany({
    where: { id: { in: ids } },
    select: { id: true, orden: true, estado: true, ciudadDestino: true, cajasEsperadas: true, creadoPorId: true },
  });
  const porId = new Map(pedidos.map((p) => [p.id, p]));

  const actualizados: string[] = [];
  const omitidos: { id: string; motivo: string }[] = [];

  for (const id of ids) {
    const pedido = porId.get(id);
    if (!pedido) {
      omitidos.push({ id, motivo: "No encontrado" });
      continue;
    }
    const estado = pedido.estado as EstadoPedidoGourmet;
    if (ESTADOS_TERMINALES_GOURMET.includes(estado)) {
      omitidos.push({ id, motivo: `Ya está en estado ${estado}` });
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const cargueActivo = await tx.gourmetCargue.findFirst({
        where: { pedidoId: id, estado: "EN_CARGUE" },
      });

      if (cargueActivo) {
        await tx.gourmetCargue.update({
          where: { id: cargueActivo.id },
          data: {
            estado: "CARGUE_COMPLETO_MANUAL",
            finalizadoAt: new Date(),
            finalizadoPorId: actor.id,
            tipoCierre: "MANUAL",
            cantidadContadaManual: pedido.cajasEsperadas,
            motivoCierreManual: MOTIVO_DESPACHO_MASIVO,
          },
        });
      } else {
        await tx.gourmetCargue.create({
          data: {
            pedidoId: id,
            iniciadoPorId: actor.id,
            iniciadoAt: new Date(),
            cantidadEsperada: pedido.cajasEsperadas,
            cantidadEscaneada: 0,
            estado: "CARGUE_COMPLETO_MANUAL",
            finalizadoAt: new Date(),
            finalizadoPorId: actor.id,
            tipoCierre: "MANUAL",
            cantidadContadaManual: pedido.cajasEsperadas,
            motivoCierreManual: MOTIVO_DESPACHO_MASIVO,
          },
        });
      }

      await tx.gourmetPedido.update({
        where: { id },
        data: {
          estado: "CARGUE_COMPLETO_MANUAL",
          cargueCompletadoAt: new Date(),
          cargueCompletadoPorId: actor.id,
          esCierreManual: true,
          cantidadContadaManual: pedido.cajasEsperadas,
          motivoCierreManual: MOTIVO_DESPACHO_MASIVO,
          observacionCierreManual: `Despachado masivamente sin verificación de cajas por ${actor.name || actor.email}.`,
        },
      });
    });

    actualizados.push(id);

    prisma.activityLog.create({
      data: {
        userId: actor.id,
        action: "UPDATE",
        module: "cargue-gourmet",
        recordId: id,
        details: `Despacho masivo sin verificación — ${pedido.orden}`,
      },
    }).catch(() => {});
  }

  if (actualizados.length > 0) {
    const destinatariosIds = new Set<string>();
    for (const id of actualizados) {
      const creadoPorId = porId.get(id)?.creadoPorId;
      if (creadoPorId) destinatariosIds.add(creadoPorId);
    }
    const adminsGerentes = await prisma.user.findMany({
      where: { active: true, role: { in: [...ROLES_NOTIFICAR] } },
      select: { id: true },
    });
    adminsGerentes.forEach((u) => destinatariosIds.add(u.id));

    if (destinatariosIds.size > 0) {
      prisma.notificacion.createMany({
        data: Array.from(destinatariosIds).map((userId) => ({
          userId,
          titulo: "Despacho masivo Cargue Gourmet",
          descripcion: `${actualizados.length} pedido(s) despachado(s) sin verificación por ${actor.name || actor.email}`,
          tipo: "CARGUE_GOURMET",
          enlace: "/dashboard/cargue-gourmet",
        })),
      }).catch(() => {});
    }
  }

  return NextResponse.json({ success: true, data: { actualizados, omitidos } });
}
