import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ALLOWED_ROLES = ["ADMIN", "GERENTE", "OPERACIONES_GOURMET", "TRANSPORTE", "SUPERVISOR_TRANSPORTE"] as const;
const ROLES_EDITAN = ["OPERACIONES_GOURMET", "ADMIN", "GERENTE"] as const;

// Estados desde los que se puede editar la cabecera (antes/durante corrección,
// nunca una vez el pedido entró en el flujo operativo de Transporte).
const ESTADOS_EDITABLES = ["BORRADOR", "UBICACION_ASIGNADA", "CON_NOVEDAD"] as const;

function mapDetalle(r: any) {
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
    cargues: (r.cargues ?? []).map((c: any) => ({
      id: c.id,
      iniciadoPorId: c.iniciadoPorId,
      iniciadoAt: c.iniciadoAt,
      finalizadoPorId: c.finalizadoPorId,
      finalizadoAt: c.finalizadoAt,
      tipoCierre: c.tipoCierre,
      cantidadEsperada: c.cantidadEsperada,
      cantidadEscaneada: c.cantidadEscaneada,
      cantidadContadaManual: c.cantidadContadaManual,
      motivoCierreManual: c.motivoCierreManual,
      observacion: c.observacion,
      estado: c.estado,
      escaneos: c.escaneos ?? [],
    })),
    novedades: r.novedades ?? [],
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

  return NextResponse.json({ success: true, data: mapDetalle(row) });
}

const updateSchema = z.object({
  orden: z.string().min(1).max(100).optional(),
  tipoOrden: z.enum(["OVDM", "TSDM"]).optional(),
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
    select: { estado: true, updatedAt: true, codigoTienda: true },
  });
  if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (!(ESTADOS_EDITABLES as readonly string[]).includes(current.estado)) {
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
  if (d.orden !== undefined) data.orden = d.orden;
  if (d.tipoOrden !== undefined) data.tipoOrden = d.tipoOrden;
  if (d.cajasEsperadas !== undefined) data.cajasEsperadas = d.cajasEsperadas;
  if (d.estibasEsperadas !== undefined) data.estibasEsperadas = d.estibasEsperadas;

  if (d.codigoTienda !== undefined && d.codigoTienda !== current.codigoTienda) {
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
