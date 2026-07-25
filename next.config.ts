import type { NextConfig } from "next";

// Reemplazo progresivo de módulos por el piloto Vue/Nuxt: rewrites condicionales,
// cada uno gateado por su propia variable de entorno — así se puede activar/
// desactivar cada módulo migrado de forma independiente (mismo deploy de nuxt-app,
// distinta variable por módulo). Sin ninguna variable definida no se agrega
// ninguna ruta — cero impacto (las páginas React originales siguen sirviendo).
// Usa `beforeFiles` a propósito: así el proxy tiene prioridad sobre la página
// existente en el filesystem (con un array simple, Next.js comprueba primero
// las páginas del filesystem y esta nunca se activaría).
// Ver docs/cerebro/decisiones.md (2026-07-03) y nuxt-app/README.md.
const NUXT_PILOT_URL = process.env.NUXT_PILOT_URL; // Guardados Transporte
const NUXT_PILOT_TIENDA_URL = process.env.NUXT_PILOT_TIENDA_URL; // Facturas Contado
const NUXT_PILOT_GOURMET_URL = process.env.NUXT_PILOT_GOURMET_URL; // Cargue Gourmet
const NUXT_PILOT_PREOP_URL = process.env.NUXT_PILOT_PREOP_URL; // Preoperacional
const NUXT_PILOT_INTEGRACION_URL = process.env.NUXT_PILOT_INTEGRACION_URL; // Integración Pedidos
const NUXT_PILOT_EXPORT_URL = process.env.NUXT_PILOT_EXPORT_URL; // Exportaciones (Ecuador + México + EE.UU)
const NUXT_PILOT_SOLICITUDES_URL = process.env.NUXT_PILOT_SOLICITUDES_URL; // Solicitudes Transporte
const NUXT_PILOT_AUDITORIA_URL = process.env.NUXT_PILOT_AUDITORIA_URL; // Auditoría

// Todas apuntan al mismo deploy de nuxt-app (app.baseURL: '/dashboard/' compartido
// en nuxt.config.ts) — sus assets (/_nuxt/*) y su $fetch interno a /api/* viven
// bajo ese prefijo sin importar qué módulo/página los pidió.
// IMPORTANTE: toda variable nueva tiene que entrar en esta cadena. Si fuera la única
// definida y no estuviera aquí, no se emitirían las reglas de /dashboard/api/* ni
// /dashboard/_nuxt/* y su página cargaría en blanco.
const SHARED_NUXT_URL = NUXT_PILOT_URL || NUXT_PILOT_TIENDA_URL || NUXT_PILOT_GOURMET_URL || NUXT_PILOT_PREOP_URL || NUXT_PILOT_INTEGRACION_URL || NUXT_PILOT_EXPORT_URL || NUXT_PILOT_SOLICITUDES_URL || NUXT_PILOT_AUDITORIA_URL;

const nextConfig: NextConfig = {
  async rewrites() {
    const beforeFiles: { source: string; destination: string }[] = [];

    if (NUXT_PILOT_URL) {
      beforeFiles.push(
        { source: "/dashboard/transporte", destination: `${NUXT_PILOT_URL}/dashboard/transporte` },
        { source: "/dashboard/transporte/:path*", destination: `${NUXT_PILOT_URL}/dashboard/transporte/:path*` },
      );
    }
    if (NUXT_PILOT_TIENDA_URL) {
      beforeFiles.push(
        { source: "/dashboard/tienda", destination: `${NUXT_PILOT_TIENDA_URL}/dashboard/tienda` },
        { source: "/dashboard/tienda/:path*", destination: `${NUXT_PILOT_TIENDA_URL}/dashboard/tienda/:path*` },
      );
    }
    if (NUXT_PILOT_GOURMET_URL) {
      beforeFiles.push(
        { source: "/dashboard/cargue-gourmet", destination: `${NUXT_PILOT_GOURMET_URL}/dashboard/cargue-gourmet` },
        { source: "/dashboard/cargue-gourmet/:path*", destination: `${NUXT_PILOT_GOURMET_URL}/dashboard/cargue-gourmet/:path*` },
      );
    }
    if (NUXT_PILOT_PREOP_URL) {
      beforeFiles.push(
        { source: "/dashboard/preoperacional", destination: `${NUXT_PILOT_PREOP_URL}/dashboard/preoperacional` },
        { source: "/dashboard/preoperacional/:path*", destination: `${NUXT_PILOT_PREOP_URL}/dashboard/preoperacional/:path*` },
      );
    }
    if (NUXT_PILOT_INTEGRACION_URL) {
      beforeFiles.push(
        { source: "/dashboard/integracion", destination: `${NUXT_PILOT_INTEGRACION_URL}/dashboard/integracion` },
        { source: "/dashboard/integracion/:path*", destination: `${NUXT_PILOT_INTEGRACION_URL}/dashboard/integracion/:path*` },
      );
    }
    if (NUXT_PILOT_AUDITORIA_URL) {
      beforeFiles.push(
        { source: "/dashboard/auditoria", destination: `${NUXT_PILOT_AUDITORIA_URL}/dashboard/auditoria` },
        { source: "/dashboard/auditoria/:path*", destination: `${NUXT_PILOT_AUDITORIA_URL}/dashboard/auditoria/:path*` },
      );
    }
    if (NUXT_PILOT_SOLICITUDES_URL) {
      beforeFiles.push(
        { source: "/dashboard/solicitudes-transporte", destination: `${NUXT_PILOT_SOLICITUDES_URL}/dashboard/solicitudes-transporte` },
        { source: "/dashboard/solicitudes-transporte/:path*", destination: `${NUXT_PILOT_SOLICITUDES_URL}/dashboard/solicitudes-transporte/:path*` },
      );
    }
    // Una sola variable activa los tres países: comparten componente y handlers,
    // así que no tiene sentido poder activar uno sin los otros.
    if (NUXT_PILOT_EXPORT_URL) {
      for (const modulo of ["exportaciones", "exportaciones-mexico", "exportaciones-eeuu"]) {
        beforeFiles.push(
          { source: `/dashboard/${modulo}`, destination: `${NUXT_PILOT_EXPORT_URL}/dashboard/${modulo}` },
          { source: `/dashboard/${modulo}/:path*`, destination: `${NUXT_PILOT_EXPORT_URL}/dashboard/${modulo}/:path*` },
        );
      }
    }
    if (SHARED_NUXT_URL) {
      beforeFiles.push(
        // El $fetch/API interno de TODAS las páginas Nuxt vive bajo /dashboard/api/*
        // (baseURL compartido) — sin esta regla, cualquier módulo Nuxt pierde sus
        // llamadas a la API en cuanto se le pega a algo distinto de /_nuxt/*.
        { source: "/dashboard/api/:path*", destination: `${SHARED_NUXT_URL}/dashboard/api/:path*` },
        // Los assets del build (JS/CSS) de TODAS las páginas Nuxt viven bajo
        // /dashboard/_nuxt/*, independiente de qué módulo los pidió.
        { source: "/dashboard/_nuxt/:path*", destination: `${SHARED_NUXT_URL}/dashboard/_nuxt/:path*` },
      );
    }

    return { beforeFiles, afterFiles: [], fallback: [] };
  },
};

export default nextConfig;
