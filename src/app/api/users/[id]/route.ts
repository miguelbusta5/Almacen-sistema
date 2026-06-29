import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { USER_ROLE_VALUES } from "@/lib/roles";
import type { Prisma } from "@prisma/client";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(USER_ROLE_VALUES).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8, "Contraseña mínimo 8 caracteres").optional(),
});

// PUT /api/users/[id] — solo ADMIN
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const d = parsed.data;

  // Evitar que el admin se desactive o se quite el rol a sí mismo
  const selfId = (session.user as { id: string }).id;
  if (id === selfId && (d.active === false || (d.role && d.role !== "ADMIN"))) {
    return NextResponse.json({ error: "No puedes desactivar ni cambiar tu propio rol de administrador" }, { status: 400 });
  }

  const data: Prisma.UserUpdateInput = {};
  if (d.name !== undefined) data.name = d.name;
  if (d.role !== undefined) data.role = d.role;
  if (d.active !== undefined) data.active = d.active;
  if (d.password) data.password = await bcrypt.hash(d.password, 12);

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, email: true, name: true, role: true, active: true },
  });

  return NextResponse.json({ success: true, data: user });
}
