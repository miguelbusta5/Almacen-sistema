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

  if (pathname.startsWith("/api/logistica")) {
    return NextResponse.json(
      { error: "Modulo logistica deshabilitado" },
      { status: 410 },
    );
  }

  // Solo proteger rutas del dashboard (mis-tareas es accesible a todos los roles autenticados)
  if (!pathname.startsWith("/dashboard")) return NextResponse.next();

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

  // Sesión presente → dejar pasar.
  // La validación de rol ocurre en:
  //   1. Servidor: requireAuth / requireCan / requireRole en cada API route
  //   2. UI: modulePermissions.ts → sidebar + CommandPalette filtrados por rol
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/logistica/:path*"],
};
