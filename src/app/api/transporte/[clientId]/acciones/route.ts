import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("despachar"),
    fechaDespacho: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
  z.object({
    tipo: z.literal("fecha_entrega"),
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
]);

// POST /api/transporte/[clientId]/acciones
// Acciones limitadas permitidas a OPERADOR: despachar y editar fecha de entrega.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;

  const { clientId } = await params;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const guardado = await prisma.transporteGuardado.findUnique({ where: { client_id: clientId } });
  if (!guardado) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (parsed.data.tipo === "despachar") {
    if (guardado.estado === "DESPACHADO") {
      return NextResponse.json({ error: "Ya está despachado" }, { status: 400 });
    }
    const fechaDespacho = parsed.data.fechaDespacho ?? new Date().toISOString().slice(0, 10);
    await prisma.transporteGuardado.update({
      where: { client_id: clientId },
      data: { estado: "DESPACHADO", fecha_despacho: new Date(fechaDespacho + "T00:00:00"), updated_at: new Date() },
    });
    await prisma.activityLog.create({
      data: { userId: actor.id, action: "UPDATE", module: "transporte", recordId: clientId, details: "Despachado por operador" },
    }).catch(() => {});
    return NextResponse.json({ success: true });
  }

  // tipo === "fecha_entrega": guarda la fecha en la nota en formato DD/MM/YYYY
  const d = parsed.data.fecha;
  const [y, m, day] = d.split("-");
  const fechaTexto = `${day}/${m}/${y}`;

  // Reemplaza fecha existente en la nota o agrega al final
  const notaActual = guardado.nota ?? "";
  const notaNueva = notaActual.match(/\d{1,2}[/\-]\d{1,2}[/\-]\d{4}/)
    ? notaActual.replace(/\d{1,2}[/\-]\d{1,2}[/\-]\d{4}/, fechaTexto)
    : (notaActual ? `${notaActual} ${fechaTexto}` : fechaTexto);

  await prisma.transporteGuardado.update({
    where: { client_id: clientId },
    data: { nota: notaNueva, updated_at: new Date() },
  });
  await prisma.activityLog.create({
    data: { userId: actor.id, action: "UPDATE", module: "transporte", recordId: clientId, details: `Fecha entrega: ${fechaTexto}` },
  }).catch(() => {});

  return NextResponse.json({ success: true, nota: notaNueva });
}
