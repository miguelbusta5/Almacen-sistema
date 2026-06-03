import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireCan } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { todayISO } from "@/lib/tienda";

const createSchema = z.object({
  centroCostos:     z.string().min(1, "Centro de costos requerido").max(100),
  numeroDocumento:  z.string().min(1, "Número de documento requerido").max(100),
  consecutivo:      z.string().min(1, "Consecutivo requerido").max(50),
  clienteNombre:    z.string().min(1, "Nombre del cliente requerido").max(255),
  clienteDocumento: z.string().max(50).nullable().optional(),
  clienteTelefono:  z.string().max(30).nullable().optional(),
  fechaCreacion:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(todayISO()),
});

function mapRow(r: any) {
  return {
    id: r.id,
    centroCostos:    r.centroCostos,
    numeroDocumento: r.numeroDocumento,
    consecutivo:     r.consecutivo,
    clienteNombre:   r.clienteNombre,
    clienteDocumento:r.clienteDocumento,
    clienteTelefono: r.clienteTelefono,
    estado:          r.estado,
    fechaCreacion:   r.fechaCreacion instanceof Date ? r.fechaCreacion.toISOString().slice(0, 10) : r.fechaCreacion,
    recibidoAt:      r.recibidoAt ? r.recibidoAt.toISOString() : null,
    despachadoAt:    r.despachadoAt ? r.despachadoAt.toISOString() : null,
    novedad:         r.novedad,
    creadoPorId:     r.creadoPorId,
    creadoPorNombre: r.creadoPor?.name ?? null,
    createdAt:       r.createdAt.toISOString(),
    updatedAt:       r.updatedAt.toISOString(),
  };
}

// GET /api/tienda?estado=&centroCostos=&q=&page=1&pageSize=200
export async function GET(req: NextRequest) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;

  const sp = req.nextUrl.searchParams;
  const page     = Math.max(1, parseInt(sp.get("page") ?? "1") || 1);
  const pageSize = Math.min(500, Math.max(20, parseInt(sp.get("pageSize") ?? "200") || 200));
  const estado   = sp.get("estado") ?? "";
  const cc       = sp.get("centroCostos") ?? "";
  const q        = sp.get("q")?.trim() ?? "";

  const where: any = {};
  if (estado) where.estado = estado;
  if (cc) where.centroCostos = { contains: cc, mode: "insensitive" };
  if (q) where.OR = [
    { numeroDocumento: { contains: q, mode: "insensitive" } },
    { clienteNombre:   { contains: q, mode: "insensitive" } },
    { consecutivo:     { contains: q, mode: "insensitive" } },
  ];

  const [rows, total] = await prisma.$transaction([
    prisma.despachoTienda.findMany({
      where,
      include: { creadoPor: { select: { id: true, name: true } } },
      orderBy: [{ fechaCreacion: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.despachoTienda.count({ where }),
  ]);

  return NextResponse.json({ success: true, data: rows.map(mapRow), total, page, pageSize });
}

// POST /api/tienda
export async function POST(req: NextRequest) {
  const actor = await requireCan("create");
  if (actor instanceof NextResponse) return actor;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const d = parsed.data;
  const row = await prisma.despachoTienda.create({
    data: {
      centroCostos:    d.centroCostos,
      numeroDocumento: d.numeroDocumento,
      consecutivo:     d.consecutivo,
      clienteNombre:   d.clienteNombre,
      clienteDocumento:d.clienteDocumento ?? null,
      clienteTelefono: d.clienteTelefono ?? null,
      fechaCreacion:   new Date(d.fechaCreacion + "T00:00:00"),
      creadoPorId:     actor.id,
    },
    include: { creadoPor: { select: { id: true, name: true } } },
  });

  await prisma.activityLog.create({
    data: { userId: actor.id, action: "CREATE", module: "tienda", recordId: row.id, details: `${d.numeroDocumento} · ${d.clienteNombre} · ${d.centroCostos}` },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: mapRow(row) }, { status: 201 });
}
