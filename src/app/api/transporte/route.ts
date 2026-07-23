import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireCan } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { Prisma, TransporteGuardado } from "@prisma/client";

function mapRow(r: TransporteGuardado) {
  return {
    id: r.id, clientId: r.client_id,
    fecha: r.fecha.toISOString().slice(0, 10),
    documento: r.documento, ubicacion: r.ubicacion,
    estado: r.estado, tipo: (r.tipo ?? "COMUN"),
    fechaDespacho: r.fecha_despacho ? r.fecha_despacho.toISOString().slice(0, 10) : null,
    nota: r.nota,
    ciudad: r.ciudad ?? null,
    codigoTienda: r.codigoTienda ?? null,
    nombreTienda: r.nombreTienda ?? null,
    netsuiteId: r.netsuiteId ?? null,
  };
}

const createSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  documento: z.string().min(1, "Documento requerido"),
  ubicacion: z.string().min(1, "Ubicación requerida"),
  estado: z.enum(["PENDIENTE DESPACHO", "DESPACHADO"]).default("PENDIENTE DESPACHO"),
  tipo: z.enum(["COMUN", "ECOMMERCE"]).default("COMUN"),
  fechaDespacho: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  nota: z.string().nullable().optional(),
  ciudad: z.string().max(100).nullable().optional(),
  codigoTienda: z.string().max(50).nullable().optional(),
  nombreTienda: z.string().max(255).nullable().optional(),
});

// GET /api/transporte?page=1&pageSize=200&q=&estado=&tipo=
export async function GET(req: NextRequest) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1") || 1);
  const pageSize = Math.min(500, Math.max(50, parseInt(sp.get("pageSize") ?? "200") || 200));
  const q = sp.get("q")?.trim() ?? "";
  const estado = sp.get("estado") ?? "";
  const tipo = sp.get("tipo") ?? "";

  const where: Prisma.TransporteGuardadoWhereInput = {};
  if (estado) where.estado = estado;
  if (tipo) where.tipo = tipo;
  if (q) where.OR = [
    { documento: { contains: q, mode: "insensitive" } },
    { ubicacion: { contains: q, mode: "insensitive" } },
  ];

  const [rows, total] = await prisma.$transaction([
    prisma.transporteGuardado.findMany({ where, orderBy: [{ fecha: "desc" }, { created_at: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.transporteGuardado.count({ where }),
  ]);

  return NextResponse.json({ success: true, data: rows.map(mapRow), total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) });
}

export async function POST(req: NextRequest) {
  const actor = await requireCan("create");
  if (actor instanceof NextResponse) return actor;
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;
  const clientId = "t" + Date.now() + Math.random().toString(36).slice(2, 6);
  const esDesp = d.estado === "DESPACHADO";
  const row = await prisma.transporteGuardado.create({
    data: {
      client_id: clientId, fecha: new Date(d.fecha + "T00:00:00"),
      documento: d.documento, ubicacion: d.ubicacion,
      estado: d.estado, tipo: d.tipo,
      fecha_despacho: esDesp && d.fechaDespacho ? new Date(d.fechaDespacho + "T00:00:00") : null,
      nota: d.nota || null,
      ciudad: d.ciudad || null,
      codigoTienda: d.codigoTienda || null,
      nombreTienda: d.nombreTienda || null,
    },
  });
  await prisma.activityLog.create({
    data: { userId: actor.id, action: "CREATE", module: "transporte", recordId: clientId, details: `${d.documento} · ${d.ubicacion} · ${d.tipo}` },
  }).catch(() => {});
  return NextResponse.json({ success: true, data: mapRow(row) }, { status: 201 });
}
