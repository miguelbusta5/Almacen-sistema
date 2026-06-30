import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { derivarTipoOrden } from "@/lib/gourmetTipoOrden";

type PedidoListRow = Prisma.GourmetPedidoGetPayload<{
  include: { creadoPor: { select: { name: true } } };
}>;

const ALLOWED_ROLES = ["ADMIN", "GERENTE", "OPERACIONES_GOURMET", "TRANSPORTE", "SUPERVISOR_TRANSPORTE"] as const;
const ROLES_CREAN = ["OPERACIONES_GOURMET", "ADMIN", "GERENTE"] as const;

const SORT_FIELDS = ["createdAt", "orden", "estado", "ciudadDestino", "enviadoTransporteAt"] as const;
type SortField = (typeof SORT_FIELDS)[number];

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 50;

function mapRow(r: PedidoListRow) {
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
    enviadoTransporteAt: r.enviadoTransporteAt,
    cargueIniciadoAt: r.cargueIniciadoAt,
    cargueCompletadoAt: r.cargueCompletadoAt,
    esCierreManual: r.esCierreManual,
  };
}

// GET /api/cargue-gourmet
export async function GET(req: NextRequest) {
  const actor = await requireRole([...ALLOWED_ROLES]);
  if (actor instanceof NextResponse) return actor;

  const sp = req.nextUrl.searchParams;
  const ciudad = sp.get("ciudad") ?? undefined;
  const estado = sp.get("estado") ?? undefined;
  const tipoOrden = sp.get("tipoOrden") ?? undefined;
  const q = sp.get("q")?.trim();
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(sp.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
  );
  const sortParam = sp.get("sort") ?? "createdAt";
  const sortField: SortField = (SORT_FIELDS as readonly string[]).includes(sortParam)
    ? (sortParam as SortField)
    : "createdAt";

  const where: Record<string, unknown> = {};
  if (ciudad) where.ciudadDestino = ciudad;
  if (estado) where.estado = estado;
  if (tipoOrden) where.tipoOrden = tipoOrden;
  if (q) {
    where.OR = [
      { orden: { contains: q, mode: "insensitive" } },
      { codigoTienda: { contains: q, mode: "insensitive" } },
      { nombreTienda: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.gourmetPedido.count({ where }),
    prisma.gourmetPedido.findMany({
      where,
      orderBy: { [sortField]: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { creadoPor: { select: { name: true } } },
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: rows.map(mapRow),
    total,
    page,
    pageSize,
  });
}

const createSchema = z.object({
  orden: z.string().min(1).max(100),
  codigoTienda: z.string().min(1).max(50),
  cajasEsperadas: z.number().int().min(1),
  estibasEsperadas: z.number().int().min(1),
});

// POST /api/cargue-gourmet
export async function POST(req: NextRequest) {
  const actor = await requireRole([...ROLES_CREAN]);
  if (actor instanceof NextResponse) return actor;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const data = parsed.data;

  const tienda = await prisma.maestroTiendaGourmet.findUnique({
    where: { codigo: data.codigoTienda },
  });
  if (!tienda) {
    return NextResponse.json({ error: "El código de tienda no existe en el maestro" }, { status: 400 });
  }
  if (!tienda.activo) {
    return NextResponse.json({ error: "La tienda está inactiva en el maestro" }, { status: 400 });
  }

  const tipoOrden = derivarTipoOrden(data.orden);

  const pedido = await prisma.gourmetPedido.create({
    data: {
      orden: data.orden,
      tipoOrden,
      codigoTienda: data.codigoTienda,
      nombreTienda: tienda.tienda,
      ciudadDestino: tienda.ciudad,
      cajasEsperadas: data.cajasEsperadas,
      estibasEsperadas: data.estibasEsperadas,
      estado: "BORRADOR",
      creadoPorId: actor.id,
    },
    include: { creadoPor: { select: { name: true } } },
  });

  prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: "CREATE",
      module: "cargue-gourmet",
      recordId: pedido.id,
      details: `${tipoOrden} ${data.orden} — tienda ${tienda.tienda}`,
    },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: mapRow(pedido) }, { status: 201 });
}
