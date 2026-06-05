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

// Nombres de cookies que usa Auth.js v5 según el entorno
const SESSION_COOKIES = [
  "__Secure-authjs.session-token", // producción HTTPS
  "authjs.session-token",           // desarrollo HTTP
  "next-auth.session-token",        // legacy v4 (compat)
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Solo proteger rutas del dashboard (mis-tareas es accesible a todos los roles autenticados)
  if (!pathname.startsWith("/dashboard")) return NextResponse.next();

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

  // Sesión presente → dejar pasar.
  // La validación de rol ocurre en:
  //   1. Servidor: requireAuth / requireCan / requireRole en cada API route
  //   2. UI: modulePermissions.ts → sidebar + CommandPalette filtrados por rol
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
