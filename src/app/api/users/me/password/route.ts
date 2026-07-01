import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const bodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "La nueva contraseña debe tener al menos 8 caracteres"),
});

// POST /api/users/me/password — cambio de la propia contraseña (forzado tras
// primer login o voluntario desde el menú de usuario).
export async function POST(req: NextRequest) {
  const actor = await requireAuth();
  if (actor instanceof NextResponse) return actor;

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { currentPassword, newPassword } = parsed.data;

  if (newPassword === currentPassword) {
    return NextResponse.json({ error: "La nueva contraseña debe ser diferente a la actual" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { password: true },
  });
  if (!user) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) {
    return NextResponse.json({ error: "La contraseña actual no es correcta" }, { status: 400 });
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: actor.id },
    data: { password: hashed, mustChangePassword: false },
  });

  prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: "UPDATE",
      module: "usuarios",
      recordId: actor.id,
      details: "Cambio de contraseña",
    },
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
