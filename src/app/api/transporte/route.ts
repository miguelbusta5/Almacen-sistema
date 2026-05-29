import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Mapea fila de Prisma → JSON limpio para el cliente
function mapRow(r: {
  id: number;
  client_id: string;
  fecha: Date;
  documento: string;
  ubicacion: string;
  estado: string;
  fecha_despacho: Date | null;
  nota: string | null;
}) {
  return {
    id: r.id,
    clientId: r.client_id,
    fecha: r.fecha.toISOString().slice(0, 10),
    documento: r.documento,
    ubicacion: r.ubicacion,
    estado: r.estado,
    fechaDespacho: r.fecha_despacho ? r.fecha_despacho.toISOString().slice(0, 10) : null,
    nota: r.nota,
  };
}

const createSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  documento: z.string().min(1, "Documento requerido"),
  ubicacion: z.string().min(1, "Ubicación requerida"),
  estado: z.enum(["PENDIENTE DESPACHO", "DESPACHADO"]).default("PENDIENTE DESPACHO"),
  fechaDespacho: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  nota: z.string().nullable().optional(),
});

// GET /api/transporte — lista todos los guardados
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rows = await prisma.transporteGuardado.findMany({
    orderBy: [{ fecha: "desc" }, { created_at: "desc" }],
  });

  return NextResponse.json({ success: true, data: rows.map(mapRow) });
}

// POST /api/transporte — crea un nuevo guardado
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  const clientId = "t" + Date.now() + Math.random().toString(36).slice(2, 6);
  const esDesp = d.estado === "DESPACHADO";

  const row = await prisma.transporteGuardado.create({
    data: {
      client_id: clientId,
      fecha: new Date(d.fecha + "T00:00:00"),
      documento: d.documento,
      ubicacion: d.ubicacion,
      estado: d.estado,
      fecha_despacho: esDesp && d.fechaDespacho ? new Date(d.fechaDespacho + "T00:00:00") : null,
      nota: d.nota || null,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: (session.user as { id: string }).id,
      action: "CREATE",
      module: "transporte",
      recordId: clientId,
      details: `${d.documento} · ${d.ubicacion}`,
    },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: mapRow(row) }, { status: 201 });
}
