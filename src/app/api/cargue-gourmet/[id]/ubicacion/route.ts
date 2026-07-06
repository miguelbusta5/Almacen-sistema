import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { assertTransicionGourmet, type EstadoPedidoGourmet } from "@/lib/gourmetCargueFlow";
import type { Prisma } from "@prisma/client";

type PedidoConUbicacion = Prisma.GourmetPedidoGetPayload<{
  include: { estibas: true; cajas: true };
}>;

const ROLES_PERMITIDOS = ["OPERACIONES_GOURMET", "ADMIN", "GERENTE"] as const;

const estibaSchema = z.object({
  secuencia: z.number().int().min(1),
  ubicacion: z.string().min(1).max(120),
  observacion: z.string().nullable().optional(),
});

const cajaSchema = z.object({
  codigoCaja: z.string().min(1).max(150).optional(),
  numeroSecuencia: z.number().int().min(1).optional(),
});

const ubicacionSchema = z.object({
  estibas: z.array(estibaSchema).min(1),
  cajas: z.array(cajaSchema).optional(),
  updatedAt: z.string().datetime(),
});

function mapPedido(r: PedidoConUbicacion) {
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
    ubicacionAsignadaAt: r.ubicacionAsignadaAt,
    ubicacionAsignadaPorId: r.ubicacionAsignadaPorId,
    enviadoTransporteAt: r.enviadoTransporteAt,
    enviadoTransportePorId: r.enviadoTransportePorId,
    cargueIniciadoAt: r.cargueIniciadoAt,
    cargueCompletadoAt: r.cargueCompletadoAt,
    estibas: r.estibas ?? [],
    cajas: r.cajas ?? [],
  };
}

// POST /api/cargue-gourmet/[id]/ubicacion
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireRole([...ROLES_PERMITIDOS]);
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;

  const body = await req.json();
  const parsed = ubicacionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  const secuencias = d.estibas.map((e) => e.secuencia);
  if (new Set(secuencias).size !== secuencias.length) {
    return NextResponse.json({ error: "No se permiten estibas con la misma secuencia" }, { status: 400 });
  }

  const cajas = d.cajas ?? [];
  const numerosCaja = cajas.map((c) => c.numeroSecuencia).filter((n): n is number => n !== undefined);
  if (new Set(numerosCaja).size !== numerosCaja.length) {
    return NextResponse.json({ error: "No se permiten cajas con el mismo numeroSecuencia" }, { status: 400 });
  }

  const current = await prisma.gourmetPedido.findUnique({
    where: { id },
    select: { estado: true, updatedAt: true },
  });
  if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const destino: EstadoPedidoGourmet = "UBICACION_ASIGNADA";
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

  // Detectar si el pedido ya tiene estibas pre-escaneadas desde la creación
  // (G2+): en ese caso, las estibas ya existen con sus cajas vinculadas;
  // solo hay que actualizar la ubicación de cada estiba por secuencia, sin
  // borrar las cajas. Si no hay estibas previas (pedido legacy), se hace el
  // flujo clásico: delete+create completo.
  // Se consulta fuera de la transacción para compatibilidad con mocks de tests.
  const estibasPrevias = await prisma.gourmetPedidoEstiba.findMany({
    where: { pedidoId: id },
    select: { id: true, secuencia: true },
  });
  const tieneEscaneoInicial = estibasPrevias.length > 0;

  const pedido = await prisma.$transaction(async (tx) => {

    if (tieneEscaneoInicial) {
      // Pedido G2+: actualizar ubicación de estibas existentes.
      // Si llegan estibas nuevas sin correspondencia previa, se crean.
      const secuenciaToId = new Map(estibasPrevias.map((e) => [e.secuencia, e.id]));
      for (const e of d.estibas) {
        const estibaId = secuenciaToId.get(e.secuencia);
        if (estibaId) {
          await tx.gourmetPedidoEstiba.update({
            where: { id: estibaId },
            data: { ubicacion: e.ubicacion ?? null, observacion: e.observacion ?? null },
          });
        } else {
          // Estiba nueva (no escaneada previamente): crearla sin cajas.
          await tx.gourmetPedidoEstiba.create({
            data: { pedidoId: id, secuencia: e.secuencia, ubicacion: e.ubicacion ?? null, observacion: e.observacion ?? null },
          });
        }
      }
      // Las cajas pre-escaneadas se conservan intactas.
      // Si se mandaron cajas adicionales en este paso, se agregan (flujo legacy).
      if (cajas.length > 0) {
        await tx.gourmetPedidoCaja.createMany({
          data: cajas.map((c) => ({
            pedidoId: id,
            codigoCaja: c.codigoCaja ?? null,
            numeroSecuencia: c.numeroSecuencia ?? null,
          })),
        });
      }
    } else {
      // Pedido legacy: flujo clásico delete+create.
      await tx.gourmetPedidoEstiba.deleteMany({ where: { pedidoId: id } });
      await tx.gourmetPedidoEstiba.createMany({
        data: d.estibas.map((e) => ({
          pedidoId: id,
          secuencia: e.secuencia,
          ubicacion: e.ubicacion ?? null,
          observacion: e.observacion ?? null,
        })),
      });
      await tx.gourmetPedidoCaja.deleteMany({ where: { pedidoId: id } });
      if (cajas.length > 0) {
        await tx.gourmetPedidoCaja.createMany({
          data: cajas.map((c) => ({
            pedidoId: id,
            codigoCaja: c.codigoCaja ?? null,
            numeroSecuencia: c.numeroSecuencia ?? null,
          })),
        });
      }
    }

    return tx.gourmetPedido.update({
      where: { id },
      data: {
        estado: "UBICACION_ASIGNADA",
        ubicacionAsignadaAt: new Date(),
        ubicacionAsignadaPorId: actor.id,
      },
      include: {
        estibas: { orderBy: { secuencia: "asc" } },
        cajas: { orderBy: [{ numeroSecuencia: "asc" }, { createdAt: "asc" }] },
      },
    });
  });

  prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: "UPDATE",
      module: "cargue-gourmet",
      recordId: pedido.id,
      details: `Ubicación asignada — ${pedido.tipoOrden} ${pedido.orden} (${d.estibas.length} estiba(s))`,
    },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: mapPedido(pedido) });
}
