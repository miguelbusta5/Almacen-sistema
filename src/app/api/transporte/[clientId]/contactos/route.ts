import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  tipo: z.enum(["LLAMADA", "MENSAJE", "EMAIL", "VISITA", "ESCALACION"]),
  resultado: z.enum(["NO_CONTESTA", "CONFIRMO_FECHA", "CANCELO", "ESCALADO", "OTRO"]),
  fechaCompromiso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  nota: z.string().nullable().optional(),
});

// GET /api/transporte/[clientId]/contactos
export async function GET(_req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  const { clientId } = await params;

  const rows = await prisma.contactoGuardado.findMany({
    where: { guardadoClientId: clientId },
    include: { registradoPorUser: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    success: true,
    data: rows.map((r) => ({
      id: r.id, guardadoClientId: r.guardadoClientId,
      tipo: r.tipo, resultado: r.resultado,
      fechaCompromiso: r.fechaCompromiso ? r.fechaCompromiso.toISOString().slice(0, 10) : null,
      nota: r.nota,
      registradoPor: r.registradoPor,
      registradoPorNombre: r.registradoPorUser?.name ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

// POST /api/transporte/[clientId]/contactos
export async function POST(req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  const { clientId } = await params;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const d = parsed.data;
  const row = await prisma.contactoGuardado.create({
    data: {
      guardadoClientId: clientId,
      tipo: d.tipo,
      resultado: d.resultado,
      fechaCompromiso: d.fechaCompromiso ? new Date(d.fechaCompromiso + "T00:00:00") : null,
      nota: d.nota ?? null,
      registradoPor: actor.id,
    },
    include: { registradoPorUser: { select: { name: true } } },
  });

  // Si el cliente confirmó fecha, actualizar la nota del guardado
  if (d.resultado === "CONFIRMO_FECHA" && d.fechaCompromiso) {
    await prisma.transporteGuardado.updateMany({
      where: { client_id: clientId },
      data: { nota: d.fechaCompromiso, updated_at: new Date() },
    }).catch(() => {});
  }

  await prisma.activityLog.create({
    data: { userId: actor.id, action: "UPDATE", module: "transporte", recordId: clientId, details: `Contacto: ${d.tipo} → ${d.resultado}` },
  }).catch(() => {});

  return NextResponse.json({ success: true, data: row }, { status: 201 });
}
