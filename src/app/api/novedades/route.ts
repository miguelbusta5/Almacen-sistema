import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

function mapRow(r: {
  id: number;
  plu: string;
  posicion: string;
  fecha: Date;
  estado: string;
  descripcion: string | null;
  cantidad: number | null;
  fabricante: string | null;
  costoUnitario: number | null;
  costoIncidencia: number | null;
}) {
  return {
    id: r.id,
    plu: r.plu,
    posicion: r.posicion,
    fecha: r.fecha.toISOString().slice(0, 10),
    estado: r.estado,
    descripcion: r.descripcion,
    cantidad: r.cantidad ?? 0,
    fabricante: r.fabricante,
    costoUnitario: r.costoUnitario,
    costoIncidencia: r.costoIncidencia,
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

// GET /api/novedades — lista todas
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rows = await prisma.novedad.findMany({
    orderBy: [{ fecha: "desc" }, { created_at: "desc" }],
  });
  return NextResponse.json({ success: true, data: rows.map(mapRow) });
}

// POST /api/novedades — crea una novedad
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

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
        userId: (session.user as { id: string }).id,
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
