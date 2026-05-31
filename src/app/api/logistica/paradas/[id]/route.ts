import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const confirmarSchema = z.object({
  estado: z.enum(["ENTREGADO", "NO_ENTREGADO"]),
  observaciones: z.string().nullable().optional(),
  fotoTomada: z.boolean().optional(),
  latEntrega: z.number().nullable().optional(),
  lngEntrega: z.number().nullable().optional(),
});

// PUT /api/logistica/paradas/[id] — confirmar entrega o actualizar parada
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;
  const body = await req.json();
  const parsed = confirmarSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const d = parsed.data;

  try {
    const parada = await prisma.parada.update({
      where: { id },
      data: {
        estado: d.estado,
        observaciones: d.observaciones ?? null,
        fotoTomada: d.fotoTomada ?? false,
        latEntrega: d.latEntrega ?? null,
        lngEntrega: d.lngEntrega ?? null,
        entregadoAt: d.estado === "ENTREGADO" ? new Date() : null,
      },
    });

    // Si está vinculada a un pedido de transporte y se entregó, marcarlo despachado
    if (d.estado === "ENTREGADO" && parada.pedidoId) {
      await prisma.transporteGuardado.updateMany({
        where: { client_id: parada.pedidoId, estado: "PENDIENTE DESPACHO" },
        data: { estado: "DESPACHADO", fecha_despacho: new Date() },
      }).catch(() => {});
    }

    await prisma.activityLog.create({
      data: { userId: actor.id, action: "UPDATE", module: "logistica", recordId: id, details: `Parada → ${d.estado}` },
    }).catch(() => {});

    return NextResponse.json({ success: true, data: parada });
  } catch { return NextResponse.json({ error: "No encontrada" }, { status: 404 }); }
}
