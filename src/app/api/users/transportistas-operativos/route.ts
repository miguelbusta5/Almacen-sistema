import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createSchema = z.object({
  nombre: z.string().min(2, "Nombre requerido").max(255),
  telefono: z.string().max(30).nullable().optional(),
  vehiculoId: z.string().nullable().optional(),
});

const updateSchema = z.object({
  id: z.string().min(1),
  nombre: z.string().min(2).max(255).optional(),
  telefono: z.string().max(30).nullable().optional(),
  vehiculoId: z.string().nullable().optional(),
  activo: z.boolean().optional(),
});

async function requireAdmin() {
  const session = await auth();
  return session && (session.user as any)?.role === "ADMIN";
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const transportistas = await prisma.transportista.findMany({
    select: {
      id: true,
      nombre: true,
      telefono: true,
      activo: true,
      user: { select: { id: true, name: true, email: true, active: true } },
      vehiculo: { select: { id: true, placa: true, tipo: true, estado: true } },
    },
    orderBy: { nombre: "asc" },
  });

  return NextResponse.json({ success: true, data: transportistas });
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const data = parsed.data;
  if (data.vehiculoId) {
    const vehiculo = await prisma.vehiculo.findUnique({ where: { id: data.vehiculoId }, select: { id: true } });
    if (!vehiculo) return NextResponse.json({ error: "Vehiculo no encontrado" }, { status: 400 });
  }

  const transportista = await prisma.transportista.create({
    data: {
      nombre: data.nombre.trim(),
      telefono: data.telefono?.trim() || null,
      vehiculoId: data.vehiculoId || null,
    },
    select: {
      id: true,
      nombre: true,
      telefono: true,
      activo: true,
      vehiculo: { select: { id: true, placa: true, tipo: true, estado: true } },
    },
  });

  return NextResponse.json({ success: true, data: transportista }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { id, ...data } = parsed.data;
  if (data.vehiculoId) {
    const vehiculo = await prisma.vehiculo.findUnique({ where: { id: data.vehiculoId }, select: { id: true } });
    if (!vehiculo) return NextResponse.json({ error: "Vehiculo no encontrado" }, { status: 400 });
  }

  const transportista = await prisma.transportista.update({
    where: { id },
    data: {
      ...(data.nombre !== undefined ? { nombre: data.nombre.trim() } : {}),
      ...(data.telefono !== undefined ? { telefono: data.telefono?.trim() || null } : {}),
      ...(data.vehiculoId !== undefined ? { vehiculoId: data.vehiculoId || null } : {}),
      ...(data.activo !== undefined ? { activo: data.activo } : {}),
    },
    select: {
      id: true,
      nombre: true,
      telefono: true,
      activo: true,
      user: { select: { id: true, name: true, email: true, active: true } },
      vehiculo: { select: { id: true, placa: true, tipo: true, estado: true } },
    },
  });

  return NextResponse.json({ success: true, data: transportista });
}
