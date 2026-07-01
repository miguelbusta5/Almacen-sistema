import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getErrorCode } from "@/lib/errors";
import type { EstadoDespacho } from "@/lib/tiendaFlow";
import { mapRow, ESTADO_LABEL, type DespachoTiendaRow } from "../route";

const ROLES_PERMITIDOS = ["ADMIN", "GERENTE"] as const;
const ROLES_NOTIFICAR = ["ADMIN", "GERENTE"] as const;

const bodySchema = z.object({
  updatedAt: z.string().datetime(),
});

// Campos por etapa que se limpian al abandonarla al revertir — simétrico a
// los timestamps que el PUT normal establece al avanzar hacia ese estado
// (ver src/app/api/tienda/[id]/route.ts, sección "Timestamps automáticos").
function camposAlAbandonar(estado: EstadoDespacho): Record<string, unknown> {
  switch (estado) {
    case "RECOGIDO_TIENDA": return { recibidoAt: null };
    case "ENTREGADO_CEDI":  return { entregadoCediAt: null };
    case "ENVIADO_CLIENTE": return { despachadoAt: null };
    case "CON_NOVEDAD":     return { novedadAt: null };
    case "RECHAZADO":       return { rechazadoAt: null, motivoRechazo: null };
    default:                return {};
  }
}

// POST /api/tienda/[id]/revertir-estado
// Acción de supervisión excepcional (ADMIN/GERENTE): revierte un despacho a
// su estado anterior real según el último HistorialDespacho, en vez de un
// mapa estático — necesario porque CON_NOVEDAD puede originarse desde
// CREADO_TIENDA, RECOGIDO_TIENDA o ENTREGADO_CEDI (ver tiendaFlow.ts).
// No se reutiliza la máquina de estados genérica (esTransicionValida): esa
// tabla solo define transiciones hacia adelante del flujo normal.
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

  const despacho = await prisma.despachoTienda.findUnique({
    where: { id },
    select: {
      id: true,
      estado: true,
      updatedAt: true,
      numeroDocumento: true,
      creadoPorId: true,
      guardadoPendiente: { select: { id: true } },
    },
  });
  if (!despacho) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (despacho.estado === "CREADO_TIENDA") {
    return NextResponse.json(
      { error: "El despacho ya está en su estado inicial, no hay nada que revertir", code: "SIN_HISTORIAL" },
      { status: 409 }
    );
  }

  if (despacho.guardadoPendiente) {
    return NextResponse.json(
      {
        error: "No se puede revertir: este despacho tiene un guardado de transporte asociado. Resuélvelo o elimínalo antes de revertir el estado.",
        code: "GUARDADO_ASOCIADO",
      },
      { status: 409 }
    );
  }

  const ultimoHistorial = await prisma.historialDespacho.findFirst({
    where: { despachoId: id },
    orderBy: { createdAt: "desc" },
    select: { estadoAnterior: true },
  });
  if (!ultimoHistorial) {
    return NextResponse.json(
      { error: "No hay historial de estados para revertir", code: "SIN_HISTORIAL" },
      { status: 409 }
    );
  }

  const origen = despacho.estado as EstadoDespacho;
  const destino = ultimoHistorial.estadoAnterior as EstadoDespacho;

  try {
    const [updatedRow] = await prisma.$transaction([
      prisma.despachoTienda.update({
        where: { id, updatedAt: new Date(d.updatedAt) },
        data: {
          estado: destino,
          ...camposAlAbandonar(origen),
        },
        include: {
          creadoPor: { select: { id: true, name: true } },
          plines: true,
          guardadoPendiente: { include: { asignadoA: { select: { name: true } } } },
        },
      }),
      prisma.historialDespacho.create({
        data: {
          despachoId: id,
          estadoAnterior: origen,
          estadoNuevo: destino,
          observacion: "Reversión manual de estado",
          usuarioId: actor.id,
        },
      }),
    ]);

    await prisma.activityLog.create({
      data: {
        userId: actor.id,
        action: "UPDATE",
        module: "tienda",
        recordId: id,
        details: `Estado revertido — ${ESTADO_LABEL[origen] ?? origen} → ${ESTADO_LABEL[destino] ?? destino}`,
      },
    }).catch(() => {});

    const destinatariosIds = new Set<string>();
    if (despacho.creadoPorId) destinatariosIds.add(despacho.creadoPorId);
    const adminsGerentes = await prisma.user.findMany({
      where: { active: true, role: { in: [...ROLES_NOTIFICAR] } },
      select: { id: true },
    });
    adminsGerentes.forEach((u) => destinatariosIds.add(u.id));
    destinatariosIds.delete(actor.id);

    if (destinatariosIds.size > 0) {
      prisma.notificacion.createMany({
        data: Array.from(destinatariosIds).map((userId) => ({
          userId,
          titulo: "Estado de despacho revertido",
          descripcion: `Doc. ${despacho.numeroDocumento}: ${ESTADO_LABEL[origen] ?? origen} → ${ESTADO_LABEL[destino] ?? destino}`,
          tipo: "TIENDA",
          enlace: "/dashboard/tienda",
        })),
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, data: mapRow(updatedRow as DespachoTiendaRow) });
  } catch (e) {
    if (getErrorCode(e) === "P2025") {
      return NextResponse.json({ error: "Conflicto: el despacho fue modificado por otro usuario", code: "CONFLICT" }, { status: 409 });
    }
    throw e;
  }
}
