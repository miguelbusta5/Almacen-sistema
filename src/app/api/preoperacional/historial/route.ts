import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

const ALLOWED = ["ADMIN", "GERENTE", "SUPERVISOR_TRANSPORTE"];

export async function GET(req: NextRequest) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;
  if (!ALLOWED.includes(actor.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const page     = Math.max(1, Number(params.get("page") ?? 1));
  const pageSize = Math.min(200, Math.max(1, Number(params.get("pageSize") ?? 50)));
  const fechaDesde  = params.get("fechaDesde");
  const fechaHasta  = params.get("fechaHasta");
  const conductorId = params.get("conductorId") || undefined;
  const estado      = params.get("estado") || undefined;

  const where: any = { vigente: true };
  if (fechaDesde) where.fecha = { ...where.fecha, gte: new Date(fechaDesde) };
  if (fechaHasta) where.fecha = { ...where.fecha, lte: new Date(fechaHasta + "T23:59:59Z") };
  if (conductorId) where.conductorId = conductorId;
  if (estado) where.estado = estado;

  const [total, rows, conductores] = await Promise.all([
    prisma.inspeccionPreoperacional.count({ where }),
    prisma.inspeccionPreoperacional.findMany({
      where,
      select: {
        id: true,
        fecha: true,
        kilometraje: true,
        observaciones: true,
        estado: true,
        conductor: { select: { id: true, nombre: true, telefono: true } },
        vehiculo:  { select: { id: true, placa: true, tipo: true } },
        _count: { select: { items: true } },
        items: {
          where: { resultado: "NO_CONFORME" },
          select: { esCritico: true },
        },
      },
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
      skip:  (page - 1) * pageSize,
      take:  pageSize,
    }),
    prisma.transportista.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const data = rows.map((r) => ({
    id:           r.id,
    fecha:        r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : r.fecha,
    kilometraje:  r.kilometraje ?? null,
    observaciones: r.observaciones ?? null,
    estado:       r.estado,
    conductor:    r.conductor,
    vehiculo:     r.vehiculo,
    itemsCount:   r._count.items,
    noConformes:  r.items.length,
    criticos:     r.items.filter((i) => i.esCritico).length,
  }));

  return NextResponse.json({
    success: true,
    data,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    conductores,
  });
}
