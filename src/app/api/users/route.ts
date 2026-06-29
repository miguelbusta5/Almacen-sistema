import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { USER_ROLE_VALUES } from "@/lib/roles";
import type { Role } from "@prisma/client";

const createUserSchema = z.object({
  email: z.string().email("Email invalido"),
  name: z.string().min(2, "Nombre muy corto"),
  password: z.string().min(8, "Contrasena minimo 8 caracteres"),
  role: z.enum(USER_ROLE_VALUES).default("INVENTARIO"),
  transportistaId: z.string().nullable().optional(), // vincular a transportista existente
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const userRole = session.user?.role ?? "";

  // Filtro por rol — accesible para supervisores de transporte y gerencia (usados en dropdowns)
  const roleFilter = req.nextUrl.searchParams.get("role");
  if (roleFilter) {
    const allowed = ["ADMIN", "GERENTE", "SUPERVISOR_TRANSPORTE", "SUPERVISOR_TIENDA", "SUPERVISOR_INVENTARIO"];
    if (!allowed.includes(userRole)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    const users = await prisma.user.findMany({
      where: { role: roleFilter as Role, active: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ success: true, data: users });
  }

  // Lista completa — solo ADMIN
  if (userRole !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ success: true, data: users });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const body = await req.json();
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  // Normalizar email a minúsculas (los correos son insensibles a mayúsculas)
  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email ya registrado" }, { status: 400 });
  }
  const { transportistaId, ...userData } = parsed.data;
  if (userData.role === "TRANSPORTISTA" && !transportistaId) {
    return NextResponse.json({ error: "Selecciona el transportista a vincular" }, { status: 400 });
  }
  if (userData.role !== "TRANSPORTISTA" && transportistaId) {
    return NextResponse.json({ error: "Solo el rol Transportista puede vincularse a un conductor" }, { status: 400 });
  }

  if (transportistaId) {
    const transportista = await prisma.transportista.findFirst({
      where: { id: transportistaId, activo: true, userId: null, vehiculoId: { not: null } },
      select: { id: true },
    });
    if (!transportista) {
      return NextResponse.json({ error: "Transportista no disponible o sin vehiculo asignado" }, { status: 400 });
    }
  }

  const hashed = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { ...userData, email, password: hashed },
      select: { id: true, email: true, name: true, role: true, active: true },
    });

    if (transportistaId) {
      await tx.transportista.update({
        where: { id: transportistaId },
        data: { userId: created.id },
      });
    }

    return created;
  });

  return NextResponse.json({ success: true, data: user }, { status: 201 });
}
