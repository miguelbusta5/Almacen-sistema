import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

function mapLinea(l: any) {
  return {
    id: l.id, cicloId: l.cicloId, plu: l.plu, descripcion: l.descripcion,
    marca: l.marca, codigoBarras: l.codigoBarras, ubicacion: l.ubicacion,
    tipoPasillo: l.tipoPasillo, autoFill: l.autoFill,
    teorico: Number(l.teorico), precioBase: l.precioBase ? Number(l.precioBase) : null,
    ultimoPrecio: l.ultimoPrecio ? Number(l.ultimoPrecio) : null,
    operarioNombre: l.operarioNombre, diaAsignado: l.diaAsignado, estado: l.estado,
    cajas: l.cajas, undEmp: l.undEmp, reguero: l.reguero,
    cantidadContada: l.cantidadContada ? Number(l.cantidadContada) : null,
    contadoPor: l.contadoPor, contadoAt: l.contadoAt?.toISOString() ?? null,
    cantidadRecontada: l.cantidadRecontada ? Number(l.cantidadRecontada) : null,
    recontadoPor: l.recontadoPor, recontadoAt: l.recontadoAt?.toISOString() ?? null,
    diferenciaFinal: l.diferenciaFinal ? Number(l.diferenciaFinal) : null,
  };
}

// GET /api/conteo/lineas?cicloId=&operario=&dia=&estado=&q=
export async function GET(req: NextRequest) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;

  const sp = req.nextUrl.searchParams;
  const cicloId = sp.get("cicloId");
  if (!cicloId) return NextResponse.json({ error: "cicloId requerido" }, { status: 400 });

  const where: any = { cicloId };
  if (sp.get("operario")) where.operarioNombre = sp.get("operario");
  if (sp.get("dia")) where.diaAsignado = parseInt(sp.get("dia")!);
  if (sp.get("estado")) where.estado = sp.get("estado");
  if (sp.get("q")) {
    const q = sp.get("q")!;
    where.OR = [
      { plu: { contains: q, mode: "insensitive" } },
      { descripcion: { contains: q, mode: "insensitive" } },
      { ubicacion: { contains: q, mode: "insensitive" } },
    ];
  }

  const lineas = await prisma.lineaConteo.findMany({
    where,
    orderBy: { ubicacion: "asc" },
    take: 500,
  });

  return NextResponse.json({ success: true, data: lineas.map(mapLinea) });
}
