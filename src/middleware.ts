// ═══════════════════════════════════════════════════════════
// MIDDLEWARE DE PROTECCIÓN DE RUTAS
// Valida sesión y rol ANTES de renderizar cualquier página.
// Corre en Edge Runtime (sin Prisma) — solo lee el JWT.
// ═══════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// Espejo de modulePermissions.ts para Edge Runtime.
// Orden importa: las rutas más específicas van primero.
const ROUTE_PROTECTION: Array<{ pattern: RegExp; roles: string[] }> = [
  // Administración
  {
    pattern: /^\/dashboard\/usuarios/,
    roles: ["ADMIN"],
  },
  {
    pattern: /^\/dashboard\/auditoria/,
    roles: ["ADMIN", "GERENTE"],
  },

  // Centro de Control
  {
    pattern: /^\/dashboard\/centro-control/,
    roles: ["GERENTE", "ADMIN", "SUPERVISOR_INVENTARIO", "SUPERVISOR_TRANSPORTE", "SUPERVISOR_TIENDA"],
  },

  // Inventario
  {
    pattern: /^\/dashboard\/inventario/,
    roles: ["INVENTARIO", "SUPERVISOR_INVENTARIO", "GERENTE", "ADMIN", "OPERADOR"],
  },

  // Tienda
  {
    pattern: /^\/dashboard\/tienda/,
    roles: ["TIENDA", "SUPERVISOR_TIENDA", "GERENTE", "ADMIN"],
  },

  // Transporte
  {
    pattern: /^\/dashboard\/transporte/,
    roles: ["TRANSPORTE", "SUPERVISOR_TRANSPORTE", "GERENTE", "ADMIN", "OPERADOR"],
  },

  // Logística (mi-ruta va antes que logística general)
  {
    pattern: /^\/dashboard\/logistica\/mi-ruta/,
    roles: ["TRANSPORTISTA", "TRANSPORTE", "SUPERVISOR_TRANSPORTE", "GERENTE", "ADMIN", "OPERADOR"],
  },
  {
    pattern: /^\/dashboard\/logistica/,
    roles: ["TRANSPORTE", "SUPERVISOR_TRANSPORTE", "GERENTE", "ADMIN"],
  },

  // Conteo (contar va antes que conteo general)
  {
    pattern: /^\/dashboard\/conteo\/contar/,
    roles: ["INVENTARIO", "SUPERVISOR_INVENTARIO", "GERENTE", "ADMIN", "OPERADOR"],
  },
  {
    pattern: /^\/dashboard\/conteo/,
    roles: ["INVENTARIO", "SUPERVISOR_INVENTARIO", "GERENTE", "ADMIN"],
  },
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Proteger solo rutas del dashboard
  if (!pathname.startsWith("/dashboard")) return NextResponse.next();

  // Leer JWT — no requiere Prisma, funciona en Edge Runtime
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  });

  // Sin sesión válida → login
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = (token.role as string | undefined) ?? "";

  // Verificar si la ruta tiene restricción de rol
  for (const { pattern, roles } of ROUTE_PROTECTION) {
    if (pattern.test(pathname)) {
      if (!roles.includes(role)) {
        // Rol no autorizado → redirigir al dashboard (no 404, para no revelar la ruta)
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
      break; // Primera regla que coincide es la que aplica
    }
  }

  return NextResponse.next();
}

export const config = {
  // Aplica a todas las rutas del dashboard y API (las APIs tienen su propia authz)
  matcher: ["/dashboard/:path*"],
};
