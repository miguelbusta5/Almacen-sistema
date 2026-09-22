// ═══════════════════════════════════════════════════════════
// MIDDLEWARE DE PROTECCIÓN DE RUTAS — Auth.js v5 compatible
//
// Verifica la presencia de la cookie de sesión.
// La validación de ROL se hace en el servidor (requireCan/requireAuth)
// y en la UI (modulePermissions → sidebar).
//
// NOTA: getToken de next-auth/jwt no es compatible con Auth.js v5.
// Usamos verificación de cookie directa para compatibilidad con Edge Runtime.
// ═══════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { decode } from "@auth/core/jwt";

// Nombres de cookies que usa Auth.js v5 según el entorno
const SESSION_COOKIES = [
  "__Secure-authjs.session-token", // producción HTTPS
  "authjs.session-token",           // desarrollo HTTP
  "next-auth.session-token",        // legacy v4 (compat)
];

/**
 * Fuerza el cambio de contraseña temporal.
 *
 * Vivía SOLO en src/app/(dashboard)/dashboard/layout.tsx, pero los 12 módulos se
 * sirven ahora desde nuxt-app vía rewrite y ese layout no llega a ejecutarse: un
 * usuario con contraseña temporal podía entrar a cualquier módulo y trabajar sin
 * cambiarla nunca. El middleware es el único punto por el que pasan las dos
 * pilas, así que el corte va aquí.
 *
 * Falla ABIERTO a propósito: si el token no se puede decodificar (rotación del
 * secreto, formato viejo) se deja pasar y el gate de sesión de cada endpoint
 * sigue aplicando. Bloquear ante un error dejaría a todo el mundo fuera.
 */
async function debeCambiarPassword(request: NextRequest): Promise<boolean> {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) return false;

  for (const salt of SESSION_COOKIES) {
    const token = request.cookies.get(salt)?.value;
    if (!token) continue;
    try {
      const payload = await decode({ token, secret, salt });
      if (payload) return payload.mustChangePassword === true;
    } catch {
      // Token con otro salt/secreto — probar el siguiente.
    }
  }
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/logistica")) {
    return NextResponse.json(
      { error: "Modulo logistica deshabilitado" },
      { status: 410 },
    );
  }

  // Solo proteger rutas del dashboard (mis-tareas es accesible a todos los roles autenticados)
  if (!pathname.startsWith("/dashboard")) return NextResponse.next();
  // Kiosco de solicitudes: sesión propia, limitada y revocable en su API.
  if (pathname === "/dashboard/stretch-pedidos" || pathname === "/dashboard/stretch-pedidos/") return NextResponse.next();

  // Assets y API de Nuxt (compartidos por TODOS los módulos migrados, vía el rewrite
  // de SHARED_NUXT_URL en next.config.ts) nunca deben quedar detrás de este gate: la
  // pantalla de Login los pide sin sesión (es, por definición, la única pantalla del
  // dashboard que se visita sin cookie), y este middleware los redirigía a /login
  // devolviendo HTML donde el navegador esperaba JS ("Failed to fetch dynamically
  // imported module"). Los endpoints de Nitro ya exigen su propia sesión
  // (requireAuth/requireCan/requireRole, ver nuxt-app/server/utils/auth.ts) y los
  // assets estáticos no necesitan protección.
  if (pathname.startsWith("/dashboard/_nuxt") || pathname.startsWith("/dashboard/api")) {
    return NextResponse.next();
  }

  // Verificar presencia de cookie de sesión
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/dashboard/logistica")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Contraseña temporal: no se entra a ningún módulo hasta cambiarla.
  if (await debeCambiarPassword(request)) {
    return NextResponse.redirect(new URL("/cambiar-password", request.url));
  }

  // Sesión presente → dejar pasar.
  // La validación de rol ocurre en:
  //   1. Servidor: requireAuth / requireCan / requireRole en cada API route
  //   2. UI: modulePermissions.ts → sidebar + CommandPalette filtrados por rol
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/logistica/:path*"],
};
