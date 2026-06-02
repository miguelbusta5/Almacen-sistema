import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email("Email invalido"),
  name: z.string().min(2, "Nombre muy corto"),
  password: z.string().min(8, "Contrasena minimo 8 caracteres"),
  role: z.enum(["ADMIN","GERENTE","OPERADOR","TRANSPORTISTA","INVENTARIO","TRANSPORTE","SUPERVISOR_INVENTARIO","SUPERVISOR_TRANSPORTE"]).default("INVENTARIO"),
  transportistaId: z.string().nullable().optional(), // vincular a transportista existente
});

export async function GET() {
  const session = await auth();
  if (!session || (session.user as any)?.role !== "ADMIN") {
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
  if (!session || (session.user as any)?.role !== "ADMIN") {
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
  const hashed = await bcrypt.hash(parsed.data.password, 12);
  const { transportistaId, ...userData } = parsed.data;
  const user = await prisma.user.create({
    data: { ...userData, email, password: hashed },
    select: { id: true, email: true, name: true, role: true, active: true },
  });

  // Si viene transportistaId, vincular el usuario al transportista
  if (transportistaId) {
    await prisma.transportista.update({
      where: { id: transportistaId },
      data: { userId: user.id },
    }).catch(() => {});
  }

  return NextResponse.json({ success: true, data: user }, { status: 201 });
}