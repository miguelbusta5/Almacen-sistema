import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireCan } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

function mapRow(r: {
  id: number; plu: string; posicion: string; fecha: Date; estado: string;
  descripcion: string | null; cantidad: number | null; fabricante: string | null;
  costoUnitario: number | null; costoIncidencia: number | null;
  tipoNovedad?: string | null; causaRaiz?: string | null; turno?: string | null;
  zonaBodega?: string | null; asignadoA?: string | null; resueltoAt?: Date | null;
  netsuiteAjust?: boolean; imagenUrl?: string | null;
}) {
  return {
    id: r.id, plu: r.plu, posicion: r.posicion,
    fecha: r.fecha.toISOString().slice(0, 10), estado: r.estado,
    descripcion: r.descripcion, cantidad: r.cantidad ?? 0,
    fabricante: r.fabricante, costoUnitario: r.costoUnitario,
    costoIncidencia: r.costoIncidencia,
    // Campos operativos
    tipoNovedad: r.tipoNovedad ?? null,
    causaRaiz: r.causaRaiz ?? null,
    turno: r.turno ?? null,
    zonaBodega: r.zonaBodega ?? null,
    asignadoA: r.asignadoA ?? null,
    resueltoAt: r.resueltoAt ? r.resueltoAt.toISOString() : null,
    netsuiteAjust: r.netsuiteAjust ?? false,
    netsuiteId: (r as any).netsuiteId ?? null,
    imagenUrl: r.imagenUrl ?? null,
    fechaCompromiso: (r as any).fechaCompromiso instanceof Date ? (r as any).fechaCompromiso.toISOString().slice(0, 10) : ((r as any).fechaCompromiso ?? null),
  };
}

const createSchema = z.object({
  plu: z.string().min(1, "PLU requerido"),
  posicion: z.string().min(1, "Posición requerida"),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  estado: z.enum(["PENDIENTE", "EN PROCESO", "SOLUCIONADO"]).default("PENDIENTE"),
  descripcion: z.string().nullable().optional(),
  cantidad: z.coerce.number().int().default(0),
  fabricante: z.string().nullable().optional(),
  costoUnitario: z.coerce.number().int().nullable().optional(),
});

// GET /api/novedades?page=1&pageSize=200&q=&estado=&fabricante=
export async function GET(req: NextRequest) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get("page") ?? "1") || 1);
  const pageSize = Math.min(500, Math.max(50, parseInt(sp.get("pageSize") ?? "200") || 200));
  const q = sp.get("q")?.trim() ?? "";
  const estado = sp.get("estado") ?? "";
  const fabricante = sp.get("fabricante") ?? "";

  const where: any = {};
  if (estado) where.estado = estado;
  if (fabricante) where.fabricante = fabricante;
  if (q) where.OR = [
    { plu: { contains: q, mode: "insensitive" } },
    { posicion: { contains: q, mode: "insensitive" } },
    { descripcion: { contains: q, mode: "insensitive" } },
    { fabricante: { contains: q, mode: "insensitive" } },
  ];

  const [rows, total] = await prisma.$transaction([
    prisma.novedad.findMany({ where, orderBy: [{ fecha: "desc" }, { created_at: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.novedad.count({ where }),
  ]);

  return NextResponse.json({ success: true, data: rows.map(mapRow), total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) });
}

// POST /api/novedades — crea una novedad
export async function POST(req: NextRequest) {
  const actor = await requireCan("create");
  if (actor instanceof NextResponse) return actor;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  try {
    const row = await prisma.novedad.create({
      data: {
        plu: d.plu,
        posicion: d.posicion,
        fecha: new Date(d.fecha + "T00:00:00"),
        estado: d.estado,
        descripcion: d.descripcion || null,
        cantidad: d.cantidad,
        fabricante: d.fabricante || null,
        costoUnitario: d.costoUnitario ?? null,
        costoIncidencia: d.costoUnitario != null ? d.costoUnitario * d.cantidad : null,
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: actor.id,
        action: "CREATE",
        module: "muebles",
        recordId: String(row.id),
        details: `PLU ${d.plu} · ${d.posicion}`,
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, data: mapRow(row) }, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Ya existe una novedad con ese PLU, posición y fecha" }, { status: 400 });
    }
    return NextResponse.json({ error: "Error al crear" }, { status: 500 });
  }
}
