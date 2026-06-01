import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const contarSchema = z.object({
  tipo: z.enum(["conteo", "reconteo"]),
  operarioNombre: z.string().min(1),
  cajas: z.number().int().nullable().optional(),
  undEmp: z.number().int().nullable().optional(),
  reguero: z.number().int().nullable().optional(),
  cantidadTotal: z.number().nullable().optional(), // si escribe total directo
});

// PUT /api/conteo/lineas/[id] — registrar conteo o reconteo
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  const { id } = await params;
  const body = await req.json();
  const parsed = contarSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { tipo, operarioNombre, cajas, undEmp, reguero, cantidadTotal } = parsed.data;

  const linea = await prisma.lineaConteo.findUnique({ where: { id } });
  if (!linea) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  // Calcular cantidad
  let cantidad: number;
  if (cajas != null && undEmp != null) {
    cantidad = cajas * undEmp + (reguero ?? 0);
  } else if (cantidadTotal != null) {
    cantidad = cantidadTotal;
  } else {
    return NextResponse.json({ error: "Debes ingresar la cantidad (cajas + und/emp o total)" }, { status: 400 });
  }

  if (tipo === "conteo") {
    await prisma.lineaConteo.update({
      where: { id },
      data: {
        estado: "CONTADO",
        cajas: cajas ?? null, undEmp: undEmp ?? null, reguero: reguero ?? null,
        cantidadContada: cantidad,
        contadoPor: operarioNombre, contadoAt: new Date(),
      },
    });
  } else {
    // reconteo: calcular diferencia final
    const diferencia = cantidad - Number(linea.teorico);
    const nuevoEstado = diferencia === 0 ? "OK" : "NOVEDAD";
    await prisma.lineaConteo.update({
      where: { id },
      data: {
        estado: nuevoEstado,
        cantidadRecontada: cantidad,
        recontadoPor: operarioNombre, recontadoAt: new Date(),
        diferenciaFinal: diferencia,
      },
    });
  }

  return NextResponse.json({ success: true });
}
