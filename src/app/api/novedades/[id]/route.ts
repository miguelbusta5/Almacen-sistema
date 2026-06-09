import { NextRequest, NextResponse } from "next/server";
import { requireCan, requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { deriveNovedadFromMaestro, normalizePlu, productoToClient } from "@/lib/productosMaestro";

const updateSchema = z.object({
  plu: z.string().min(1).optional(),
  posicion: z.string().min(1).optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  estado: z.enum(["PENDIENTE", "EN PROCESO", "SOLUCIONADO"]).optional(),
  descripcion: z.string().nullable().optional(),
  cantidad: z.coerce.number().int().optional(),
  fabricante: z.string().nullable().optional(),
  costoUnitario: z.coerce.number().int().nullable().optional(),
  // Campos operativos (Iniciativa 1)
  tipoNovedad: z.string().nullable().optional(),
  causaRaiz: z.string().nullable().optional(),
  turno: z.string().nullable().optional(),
  zonaBodega: z.string().nullable().optional(),
  asignadoA: z.string().nullable().optional(),
  netsuiteAjust: z.boolean().optional(),
  netsuiteId:   z.string().max(100).nullable().optional(),
  imagenUrl: z.string().nullable().optional(),
  fechaCompromiso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

// PUT /api/novedades/[id] — GERENTE+ para edición general; OPERADOR puede asignar/clasificar
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;

  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  const actualNovedad = await prisma.novedad.findUnique({
    where: { id: numId },
    select: { plu: true, cantidad: true },
  });
  if (!actualNovedad) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const effectivePlu = normalizePlu(d.plu ?? actualNovedad.plu);
  const producto = await prisma.productoMaestro.findUnique({
    where: { plu: effectivePlu },
    select: { plu: true, descripcion: true, fabricante: true, precio: true, marca: true },
  });
  const derived = deriveNovedadFromMaestro({
    descripcion: d.descripcion ?? null,
    fabricante: d.fabricante ?? null,
    costoUnitario: d.costoUnitario ?? null,
  }, producto ? productoToClient(producto) : null, actor.role === "ADMIN");

  // Recalcular impacto si se envió costo unitario (impacto = costo × cantidad).
  // Si no se envía cantidad en el body, usar la existente.
  let costoIncidencia: number | undefined;
  if (derived.costoUnitario != null) {
    let cant = d.cantidad;
    if (cant === undefined) {
      cant = actualNovedad.cantidad ?? 0;
    }
    costoIncidencia = derived.costoUnitario * cant;
  }

  // Determinar resueltoAt si se está solucionando
  const resueltoAt = d.estado === "SOLUCIONADO" ? new Date() : undefined;

  await prisma.novedad.update({
    where: { id: numId },
    data: {
      ...(d.plu !== undefined && { plu: effectivePlu }),
      ...(d.posicion !== undefined && { posicion: d.posicion }),
      ...(d.fecha !== undefined && { fecha: new Date(d.fecha + "T00:00:00") }),
      ...(d.estado !== undefined && { estado: d.estado }),
      ...(producto && actor.role !== "ADMIN" ? { descripcion: derived.descripcion } : (d.descripcion !== undefined && { descripcion: d.descripcion })),
      ...(d.cantidad !== undefined && { cantidad: d.cantidad }),
      ...(producto && actor.role !== "ADMIN" ? { fabricante: derived.fabricante } : (d.fabricante !== undefined && { fabricante: d.fabricante })),
      ...(producto && actor.role !== "ADMIN" ? { costoUnitario: derived.costoUnitario } : (d.costoUnitario !== undefined && { costoUnitario: d.costoUnitario })),
      ...(costoIncidencia !== undefined && { costoIncidencia }),
      // Campos operativos
      ...(d.tipoNovedad !== undefined && { tipoNovedad: d.tipoNovedad }),
      ...(d.causaRaiz !== undefined && { causaRaiz: d.causaRaiz }),
      ...(d.turno !== undefined && { turno: d.turno }),
      ...(d.zonaBodega !== undefined && { zonaBodega: d.zonaBodega }),
      ...(d.asignadoA !== undefined && { asignadoA: d.asignadoA }),
      ...(d.netsuiteAjust !== undefined && { netsuiteAjust: d.netsuiteAjust }),
      ...(d.netsuiteId   !== undefined && { netsuiteId:   d.netsuiteId }),
      ...(d.imagenUrl !== undefined && { imagenUrl: d.imagenUrl }),
      ...(d.fechaCompromiso !== undefined && { fechaCompromiso: d.fechaCompromiso ? new Date(d.fechaCompromiso + "T00:00:00") : null }),
      ...(resueltoAt && { resueltoAt }),
      updated_at: new Date(),
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: "UPDATE",
      module: "muebles",
      recordId: id,
      details: d.estado ? `Estado: ${d.estado}` : "Actualización",
    },
  }).catch(() => {});

  return NextResponse.json({ success: true });
}

// DELETE /api/novedades/[id] — solo ADMIN
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await requireCan("delete");
  if (actor instanceof NextResponse) return actor;

  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  await prisma.novedad.delete({ where: { id: numId } }).catch(() => {});

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: "DELETE",
      module: "muebles",
      recordId: id,
    },
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
