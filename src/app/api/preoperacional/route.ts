import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  CHECKLIST_PREOPERACIONAL,
  estadoDesdeItems,
  todayISO,
  type ResultadoInspeccion,
} from "@/lib/preoperacional";
import type { Prisma } from "@prisma/client";

type InspeccionRow = Prisma.InspeccionPreoperacionalGetPayload<{
  include: { vehiculo: true; conductor: true; items: true };
}>;

const itemSchema = z.object({
  item: z.string().min(1),
  resultado: z.enum(["CONFORME", "NO_CONFORME", "NO_APLICA"]),
  observacion: z.string().nullable().optional(),
  fotoUrl: z.string().url().nullable().optional(),
});

const createSchema = z.object({
  kilometraje: z.number().int().min(0).nullable().optional(),
  observaciones: z.string().nullable().optional(),
  items: z.array(itemSchema).min(CHECKLIST_PREOPERACIONAL.length),
});

function mapInspeccion(i: InspeccionRow) {
  return {
    id: i.id,
    fecha: i.fecha instanceof Date ? i.fecha.toISOString().slice(0, 10) : i.fecha,
    kilometraje: i.kilometraje ?? null,
    observaciones: i.observaciones ?? null,
    estado: i.estado,
    vigente: i.vigente,
    createdAt: i.createdAt.toISOString(),
    vehiculo: i.vehiculo ? { id: i.vehiculo.id, placa: i.vehiculo.placa, tipo: i.vehiculo.tipo } : null,
    conductor: i.conductor ? { id: i.conductor.id, nombre: i.conductor.nombre } : null,
    items: (i.items ?? []).map((item) => ({
      id: item.id,
      categoria: item.categoria,
      item: item.item,
      resultado: item.resultado,
      esCritico: item.esCritico,
      fotoUrl: item.fotoUrl ?? null,
      observacion: item.observacion ?? null,
    })),
  };
}

async function getTransportista(userId: string) {
  return prisma.transportista.findFirst({
    where: { userId, activo: true },
    include: { vehiculo: true },
  });
}

export async function GET() {
  const actor = await requireRole(["TRANSPORTISTA"]);
  if (actor instanceof NextResponse) return actor;

  const transportista = await getTransportista(actor.id);
  if (!transportista) {
    return NextResponse.json({
      success: true,
      checklist: CHECKLIST_PREOPERACIONAL,
      transportista: null,
      vehiculo: null,
      inspeccionHoy: null,
      historial: [],
    });
  }

  const [inspeccionHoy, historial] = await Promise.all([
    prisma.inspeccionPreoperacional.findFirst({
      where: { conductorId: transportista.id, fecha: new Date(todayISO()), vigente: true },
      include: { vehiculo: true, conductor: true, items: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.inspeccionPreoperacional.findMany({
      where: { conductorId: transportista.id },
      include: { vehiculo: true, conductor: true, items: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return NextResponse.json({
    success: true,
    checklist: CHECKLIST_PREOPERACIONAL,
    transportista: {
      id: transportista.id,
      nombre: transportista.nombre,
      telefono: transportista.telefono ?? null,
    },
    vehiculo: transportista.vehiculo ? {
      id: transportista.vehiculo.id,
      placa: transportista.vehiculo.placa,
      tipo: transportista.vehiculo.tipo,
      estado: transportista.vehiculo.estado,
    } : null,
    inspeccionHoy: inspeccionHoy ? mapInspeccion(inspeccionHoy) : null,
    historial: historial.map(mapInspeccion),
  });
}

export async function POST(req: NextRequest) {
  const actor = await requireRole(["TRANSPORTISTA"]);
  if (actor instanceof NextResponse) return actor;

  const transportista = await getTransportista(actor.id);
  if (!transportista) return NextResponse.json({ error: "Tu usuario no esta vinculado a un transportista activo" }, { status: 409 });
  if (!transportista.vehiculoId) return NextResponse.json({ error: "No tienes vehiculo asignado para registrar preoperacional" }, { status: 409 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const byName = new Map(CHECKLIST_PREOPERACIONAL.map((item) => [item.item, item]));
  const items: Array<{
    categoria: string;
    item: string;
    resultado: ResultadoInspeccion;
    esCritico: boolean;
    fotoUrl: string | null;
    observacion: string | null;
  }> = [];
  for (const incoming of parsed.data.items) {
    const base = byName.get(incoming.item);
    if (!base) return NextResponse.json({ error: "Item de checklist invalido" }, { status: 400 });
    items.push({
      categoria: base.categoria,
      item: base.item,
      resultado: incoming.resultado as ResultadoInspeccion,
      esCritico: base.esCritico,
      fotoUrl: incoming.fotoUrl ?? null,
      observacion: incoming.observacion?.trim() || null,
    });
  }

  const estado = estadoDesdeItems(items);
  const fecha = new Date(todayISO());

  const inspeccion = await prisma.$transaction(async (tx) => {
    await tx.inspeccionPreoperacional.updateMany({
      where: { conductorId: transportista.id, fecha, vigente: true },
      data: { vigente: false },
    });

    const row = await tx.inspeccionPreoperacional.create({
      data: {
        vehiculoId: transportista.vehiculoId!,
        conductorId: transportista.id,
        realizadoPorId: actor.id,
        fecha,
        kilometraje: parsed.data.kilometraje ?? null,
        observaciones: parsed.data.observaciones?.trim() || null,
        estado,
        vigente: true,
        items: { create: items },
      },
      include: { vehiculo: true, conductor: true, items: true },
    });

    await tx.activityLog.create({
      data: {
        userId: actor.id,
        action: "CREATE",
        module: "preoperacional",
        recordId: row.id,
        details: `${row.vehiculo.placa} - ${estado}`,
      },
    }).catch(() => {});

    return row;
  });

  return NextResponse.json({ success: true, data: mapInspeccion(inspeccion) }, { status: 201 });
}
