import type { NextConfig } from "next";

// Reemplazo de Guardados Transporte por el piloto Vue/Nuxt: rewrite condicional,
// solo activo si se define NUXT_PILOT_URL. Sin esa variable no se agrega ninguna
// ruta — cero impacto (la página React original sigue sirviendo /dashboard/transporte).
// Usa `beforeFiles` a propósito: así el proxy tiene prioridad sobre la página
// existente en src/app/(dashboard)/dashboard/transporte/page.tsx (con un array
// simple, Next.js comprueba primero las páginas del filesystem y esta nunca se
// activaría). Ver docs/cerebro/decisiones.md (2026-07-03) y nuxt-app/README.md.
const NUXT_PILOT_URL = process.env.NUXT_PILOT_URL;

const nextConfig: NextConfig = {
  async rewrites() {
    if (!NUXT_PILOT_URL) return { beforeFiles: [], afterFiles: [], fallback: [] };
    return {
      beforeFiles: [
        // El destino preserva /dashboard/transporte porque la app Nuxt tiene
        // app.baseURL: '/dashboard/transporte/' (nuxt.config.ts) — sus assets
        // (/_nuxt/*) y su $fetch interno a /api/* ya asumen vivir bajo ese
        // prefijo, así que el proxy debe mantenerlo en vez de mandar a la raíz.
        { source: "/dashboard/transporte", destination: `${NUXT_PILOT_URL}/dashboard/transporte` },
        { source: "/dashboard/transporte/:path*", destination: `${NUXT_PILOT_URL}/dashboard/transporte/:path*` },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
