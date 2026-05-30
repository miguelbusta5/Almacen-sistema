import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { UserRole } from "@/types";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

/** Devuelve el usuario de la sesión actual, o null si no hay sesión válida. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const u = session?.user as Partial<SessionUser> | undefined;
  if (!u?.id || !u.role) return null;
  return { id: u.id, email: u.email ?? "", name: u.name ?? "", role: u.role };
}

/**
 * Exige una sesión autenticada.
 * Devuelve el usuario, o un NextResponse 401 listo para retornar desde el handler.
 *
 * Uso:
 *   const actor = await requireAuth();
 *   if (actor instanceof NextResponse) return actor;
 *   // actor: SessionUser
 */
export async function requireAuth(): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return user;
}

/**
 * Exige que el usuario tenga uno de los roles indicados.
 * Devuelve el usuario, o un NextResponse 401 (sin sesión) / 403 (sin permiso).
 */
export async function requireRole(
  roles: UserRole[]
): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!roles.includes(user.role)) {
    return NextResponse.json(
      { error: "No tienes permisos para realizar esta acción" },
      { status: 403 }
    );
  }
  return user;
}
