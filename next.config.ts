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
        { source: "/dashboard/transporte", destination: `${NUXT_PILOT_URL}/` },
        { source: "/dashboard/transporte/:path*", destination: `${NUXT_PILOT_URL}/:path*` },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
