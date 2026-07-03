import type { NextConfig } from "next";

// Piloto Guardados (Vue/Nuxt): rewrite condicional, solo activo si se define
// NUXT_PILOT_URL. Sin esa variable no se agrega ninguna ruta — cero impacto
// en producción. Ver docs/cerebro/decisiones.md (2026-07-03) y nuxt-app/README.md.
const NUXT_PILOT_URL = process.env.NUXT_PILOT_URL;

const nextConfig: NextConfig = {
  async rewrites() {
    if (!NUXT_PILOT_URL) return [];
    return [
      {
        source: "/dashboard/transporte-piloto",
        destination: `${NUXT_PILOT_URL}/`,
      },
      {
        source: "/dashboard/transporte-piloto/:path*",
        destination: `${NUXT_PILOT_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
