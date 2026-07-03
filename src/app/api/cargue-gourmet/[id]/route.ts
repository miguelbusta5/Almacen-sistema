import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { derivarTipoOrden } from "@/lib/gourmetTipoOrden";
import { CIUDAD_TIENDA_CLIENTE, CODIGO_TIENDA_CLIENTE, NOMBRE_TIENDA_CLIENTE, esCodigoTiendaCliente } from "@/lib/gourmetCliente";

// Payload con todas las relaciones (forma del GET).
type PedidoFull = Prisma.GourmetPedidoGetPayload<{
  include: {
    creadoPor: { select: { name: true } };
    estibas: true;
    cajas: true;
    cargues: { include: { escaneos: true } };
    novedades: true;
  };
}>;

// El PUT mapea un pedido sin relaciones cargadas (solo creadoPor) → las
// relaciones son opcionales para que ambos call-sites encajen sin `any`.
type PedidoDetalle = Omit<PedidoFull, "estibas" | "cajas" | "cargues" | "novedades"> &
  Partial<Pick<PedidoFull, "estibas" | "cajas" | "cargues" | "novedades">>;

const ALLOWED_ROLES = ["ADMIN", "GERENTE", "OPERACIONES_GOURMET", "TRANSPORTE", "SUPERVISOR_TRANSPORTE"] as const;
const ROLES_EDITAN = ["OPERACIONES_GOURMET", "ADMIN", "GERENTE"] as const;
const ROLES_ELIMINAN = ["ADMIN", "GERENTE"] as const;

// Estados desde los que se puede editar la cabecera (antes/durante corrección,
// nunca una vez el pedido entró en el flujo operativo de Transporte).
const ESTADOS_EDITABLES = ["BORRADOR", "UBICACION_ASIGNADA", "CON_NOVEDAD"] as const;

// `iniciadoPorId`/`finalizadoPorId` (cargues), `escaneadoPorId` (escaneos) y
// `registradaPorId`/`resueltaPorId` (novedades) son columnas planas sin
// relación de Prisma a `User` (a diferencia de `creadoPorId`, que sí la
// tiene) — se resuelven a nombre con un solo `findMany` por id, no con
// relaciones en el schema.
function mapDetalle(r: PedidoDetalle, nombrePorId: Map<string, string> = new Map()) {
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
    creadoPorId: r.creadoPorId,
    creadoPorNombre: r.creadoPor?.name ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    ubicacionAsignadaAt: r.ubicacionAsignadaAt,
    ubicacionAsignadaPorId: r.ubicacionAsignadaPorId,
    enviadoTransporteAt: r.enviadoTransporteAt,
    enviadoTransportePorId: r.enviadoTransportePorId,
    cargueIniciadoAt: r.cargueIniciadoAt,
    cargueIniciadoPorId: r.cargueIniciadoPorId,
    cargueCompletadoAt: r.cargueCompletadoAt,
    cargueCompletadoPorId: r.cargueCompletadoPorId,
    esCierreManual: r.esCierreManual,
    cantidadContadaManual: r.cantidadContadaManual,
    motivoCierreManual: r.motivoCierreManual,
    observacionCierreManual: r.observacionCierreManual,
    estibas: r.estibas ?? [],
    cajas: r.cajas ?? [],
    cargues: (r.cargues ?? []).map((c) => ({
      id: c.id,
      iniciadoPorId: c.iniciadoPorId,
      iniciadoPorNombre: nombrePorId.get(c.iniciadoPorId) ?? null,
      iniciadoAt: c.iniciadoAt,
      finalizadoPorId: c.finalizadoPorId,
      finalizadoPorNombre: c.finalizadoPorId ? nombrePorId.get(c.finalizadoPorId) ?? null : null,
      finalizadoAt: c.finalizadoAt,
      tipoCierre: c.tipoCierre,
      cantidadEsperada: c.cantidadEsperada,
      cantidadEscaneada: c.cantidadEscaneada,
      cantidadContadaManual: c.cantidadContadaManual,
      motivoCierreManual: c.motivoCierreManual,
      observacion: c.observacion,
      estado: c.estado,
      escaneos: (c.escaneos ?? []).map((e) => ({
        ...e,
        escaneadoPorNombre: nombrePorId.get(e.escaneadoPorId) ?? null,
      })),
    })),
    novedades: (r.novedades ?? []).map((n) => ({
      ...n,
      registradaPorNombre: nombrePorId.get(n.registradaPorId) ?? null,
      resueltaPorNombre: n.resueltaPorId ? nombrePorId.get(n.resueltaPorId) ?? null : null,
    })),
  };
}

// GET /api/cargue-gourmet/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireRole([...ALLOWED_ROLES]);
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;

  const row = await prisma.gourmetPedido.findUnique({
    where: { id },
    include: {
      creadoPor: { select: { name: true } },
      estibas: { orderBy: { secuencia: "asc" } },
      cajas: { orderBy: [{ numeroSecuencia: "asc" }, { createdAt: "asc" }] },
      cargues: {
        orderBy: { iniciadoAt: "desc" },
        include: {
          escaneos: { orderBy: { createdAt: "desc" } },
        },
      },
      novedades: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!row) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const actorIds = new Set<string>();
  for (const c of row.cargues) {
    actorIds.add(c.iniciadoPorId);
    if (c.finalizadoPorId) actorIds.add(c.finalizadoPorId);
    for (const e of c.escaneos) actorIds.add(e.escaneadoPorId);
  }
  for (const n of row.novedades) {
    actorIds.add(n.registradaPorId);
    if (n.resueltaPorId) actorIds.add(n.resueltaPorId);
  }
  const actores = actorIds.size > 0
    ? await prisma.user.findMany({ where: { id: { in: [...actorIds] } }, select: { id: true, name: true } })
    : [];
  const nombrePorId = new Map(actores.map((u) => [u.id, u.name]));

  return NextResponse.json({ success: true, data: mapDetalle(row, nombrePorId) });
}

const updateSchema = z.object({
  orden: z.string().min(1).max(100).optional(),
  codigoTienda: z.string().min(1).max(50).optional(),
  cajasEsperadas: z.number().int().min(1).optional(),
  estibasEsperadas: z.number().int().min(1).optional(),
  updatedAt: z.string().datetime(),
});

// PUT /api/cargue-gourmet/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireRole([...ROLES_EDITAN]);
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  const current = await prisma.gourmetPedido.findUnique({
    where: { id },
    select: { estado: true, updatedAt: true, codigoTienda: true, orden: true },
  });
  if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // ADMIN/GERENTE pueden corregir datos básicos sin importar el estado del
  // pedido; OPERACIONES_GOURMET conserva la restricción a estados tempranos.
  const esGestor = actor.role === "ADMIN" || actor.role === "GERENTE";
  if (!esGestor && !(ESTADOS_EDITABLES as readonly string[]).includes(current.estado)) {
    return NextResponse.json(
      { error: `No se puede editar un pedido en estado ${current.estado}`, code: "ESTADO_NO_EDITABLE" },
      { status: 409 }
    );
  }

  if (new Date(d.updatedAt).getTime() !== current.updatedAt.getTime()) {
    return NextResponse.json(
      { error: "Conflicto: el pedido fue modificado por otro usuario", code: "CONFLICT" },
      { status: 409 }
    );
  }

  const data: Record<string, unknown> = {};
  if (d.orden !== undefined) {
    // Evita que editar deje dos pedidos con la misma orden (p. ej. el usuario
    // corrige la cantidad pero, por error, en realidad crea un pedido nuevo
    // aparte y luego intenta "unificar" cambiando la orden de este) — mismo
    // chequeo case-insensitive que en POST, excluyendo el propio registro.
    const ordenTrim = d.orden.trim();
    if (ordenTrim.toLowerCase() !== current.orden.trim().toLowerCase()) {
      const duplicado = await prisma.gourmetPedido.findFirst({
        where: {
          id: { not: id },
          orden: { equals: ordenTrim, mode: "insensitive" },
          estado: { not: "CANCELADO" },
        },
        select: { id: true, estado: true },
      });
      if (duplicado) {
        return NextResponse.json(
          {
            error: `Ya existe otro pedido con la orden "${ordenTrim}" (estado: ${duplicado.estado}).`,
            code: "ORDEN_DUPLICADA",
            data: { id: duplicado.id, estado: duplicado.estado },
          },
          { status: 409 }
        );
      }
    }
    data.orden = d.orden;
    data.tipoOrden = derivarTipoOrden(d.orden);
  }
  if (d.cajasEsperadas !== undefined) data.cajasEsperadas = d.cajasEsperadas;
  if (d.estibasEsperadas !== undefined) data.estibasEsperadas = d.estibasEsperadas;

  if (d.codigoTienda !== undefined && d.codigoTienda !== current.codigoTienda) {
    if (esCodigoTiendaCliente(d.codigoTienda)) {
      data.codigoTienda = CODIGO_TIENDA_CLIENTE;
      data.nombreTienda = NOMBRE_TIENDA_CLIENTE;
      data.ciudadDestino = CIUDAD_TIENDA_CLIENTE;
    } else {
      const tienda = await prisma.maestroTiendaGourmet.findUnique({ where: { codigo: d.codigoTienda } });
      if (!tienda) {
        return NextResponse.json({ error: "El código de tienda no existe en el maestro" }, { status: 400 });
      }
      if (!tienda.activo) {
        return NextResponse.json({ error: "La tienda está inactiva en el maestro" }, { status: 400 });
      }
      data.codigoTienda = tienda.codigo;
      data.nombreTienda = tienda.tienda;
      data.ciudadDestino = tienda.ciudad;
    }
  }

  const pedido = await prisma.gourmetPedido.update({
    where: { id },
    data,
    include: { creadoPor: { select: { name: true } } },
  });

  prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: "UPDATE",
      module: "cargue-gourmet",
      recordId: pedido.id,
      details: `Edición de datos básicos — ${pedido.tipoOrden} ${pedido.orden}`,
    },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: mapDetalle(pedido) });
}

// DELETE /api/cargue-gourmet/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireRole([...ROLES_ELIMINAN]);
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;

  const pedido = await prisma.gourmetPedido.findUnique({
    where: { id },
    select: { estado: true, orden: true, tipoOrden: true },
  });
  if (!pedido) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (pedido.estado === "EN_CARGUE") {
    return NextResponse.json(
      { error: "No se puede eliminar un pedido con cargue en curso. Revierte el cargue primero.", code: "CARGUE_EN_CURSO" },
      { status: 409 }
    );
  }

  // Las relaciones (estibas, cajas, cargues → escaneos/novedades) tienen
  // onDelete: Cascade en el schema — no requieren borrado manual.
  await prisma.gourmetPedido.delete({ where: { id } });

  prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: "DELETE",
      module: "cargue-gourmet",
      recordId: id,
      details: `Pedido eliminado — ${pedido.tipoOrden} ${pedido.orden}`,
    },
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
