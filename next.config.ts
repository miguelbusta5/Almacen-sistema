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
const NUXT_PILOT_USUARIOS_URL = process.env.NUXT_PILOT_USUARIOS_URL; // Usuarios
const NUXT_PILOT_LOGIN_URL = process.env.NUXT_PILOT_LOGIN_URL; // Login
// Control Montacargas + Resurtido + Recepcion de Contenedores. Una sola
// variable para los tres: son el mismo deploy de nuxt-app y comparten el flujo
// del CEDI, asi que un modulo nuevo entra sin tocar Vercel.
const NUXT_PILOT_MONTACARGAS_URL = process.env.NUXT_PILOT_MONTACARGAS_URL;
// Picking e Inspeccion de Muebles. Variable APARTE de la del resto del CEDI a
// proposito: el modulo esta en prototipo y mientras esta variable no exista en
// Vercel Production, /dashboard/picking-muebles no se sirve en produccion. Es el
// segundo candado, ademas de que ningun usuario real tiene los roles nuevos.
const NUXT_PILOT_MUEBLES_URL = process.env.NUXT_PILOT_MUEBLES_URL;

// Todas apuntan al mismo deploy de nuxt-app (app.baseURL: '/dashboard/' compartido
// en nuxt.config.ts) — sus assets (/_nuxt/*) y su $fetch interno a /api/* viven
// bajo ese prefijo sin importar qué módulo/página los pidió.
// IMPORTANTE: toda variable nueva tiene que entrar en esta cadena. Si fuera la única
// definida y no estuviera aquí, no se emitirían las reglas de /dashboard/api/* ni
// /dashboard/_nuxt/* y su página cargaría en blanco.
const SHARED_NUXT_URL = NUXT_PILOT_MUEBLES_URL || NUXT_PILOT_URL || NUXT_PILOT_TIENDA_URL || NUXT_PILOT_GOURMET_URL || NUXT_PILOT_PREOP_URL || NUXT_PILOT_INTEGRACION_URL || NUXT_PILOT_EXPORT_URL || NUXT_PILOT_SOLICITUDES_URL || NUXT_PILOT_AUDITORIA_URL || NUXT_PILOT_USUARIOS_URL || NUXT_PILOT_LOGIN_URL || NUXT_PILOT_MONTACARGAS_URL;

// Cabeceras de seguridad. La app no tenia ninguna: sin ellas el navegador no
// impide que la pongan en un iframe (clickjacking sobre una sesion abierta), ni
// fuerza HTTPS en visitas siguientes, ni limita a donde se filtra la URL.
// Se aplican a TODAS las rutas, incluidas las proxeadas a Nuxt (los rewrites de
// beforeFiles no emiten cabeceras propias).
const SECURITY_HEADERS = [
  // La app se sirve solo desde su propio dominio; nunca debe embeberse.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // No filtrar la ruta completa (que lleva ids de pedido/estiba) a terceros.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // No se usa ninguna de estas APIs: negarlas de raiz. La camara NO se niega:
  // el escaner de Cargue Gourmet la necesita (CameraScanner.vue).
  { key: "Permissions-Policy", value: "geolocation=(), microphone=(), payment=(), usb=()" },
  // 2 anios + subdominios. Vercel ya sirve solo HTTPS; esto ademas evita el
  // primer request en claro, que es donde una contrasena viajaria expuesta.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // `headers()` se aplica tambien a las rutas reescritas hacia nuxt-app.
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },

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
    if (NUXT_PILOT_INTEGRACION_URL) {
      beforeFiles.push(
        { source: "/dashboard/integracion", destination: `${NUXT_PILOT_INTEGRACION_URL}/dashboard/integracion` },
        { source: "/dashboard/integracion/:path*", destination: `${NUXT_PILOT_INTEGRACION_URL}/dashboard/integracion/:path*` },
      );
    }
    if (NUXT_PILOT_USUARIOS_URL) {
      beforeFiles.push(
        { source: "/dashboard/usuarios", destination: `${NUXT_PILOT_USUARIOS_URL}/dashboard/usuarios` },
        { source: "/dashboard/usuarios/:path*", destination: `${NUXT_PILOT_USUARIOS_URL}/dashboard/usuarios/:path*` },
      );
    }
    if (NUXT_PILOT_AUDITORIA_URL) {
      beforeFiles.push(
        { source: "/dashboard/auditoria", destination: `${NUXT_PILOT_AUDITORIA_URL}/dashboard/auditoria` },
        { source: "/dashboard/auditoria/:path*", destination: `${NUXT_PILOT_AUDITORIA_URL}/dashboard/auditoria/:path*` },
      );
    }
    // Una sola variable activa todos los módulos del CEDI: comparten deploy, y
    // ninguno tiene página React de respaldo (se construyeron directo en Nuxt),
    // así que sin esta variable las rutas dan 404 en vez de degradar.
    if (NUXT_PILOT_MONTACARGAS_URL) {
      for (const modulo of [
        "control-montacargas", "resurtido", "recepcion-contenedores",
        "montaje-resurtido", "pendientes", "indicadores", "capacidad-picking",
      ]) {
        beforeFiles.push(
          { source: `/dashboard/${modulo}`, destination: `${NUXT_PILOT_MONTACARGAS_URL}/dashboard/${modulo}` },
          { source: `/dashboard/${modulo}/:path*`, destination: `${NUXT_PILOT_MONTACARGAS_URL}/dashboard/${modulo}/:path*` },
        );
      }
    }
    if (NUXT_PILOT_MUEBLES_URL) {
      for (const modulo of [
        "picking-muebles", "inspeccion-muebles", "indicadores-muebles", "admin-muebles",
      ]) {
        beforeFiles.push(
          { source: `/dashboard/${modulo}`, destination: `${NUXT_PILOT_MUEBLES_URL}/dashboard/${modulo}` },
          { source: `/dashboard/${modulo}/:path*`, destination: `${NUXT_PILOT_MUEBLES_URL}/dashboard/${modulo}/:path*` },
        );
      }
    }
    if (NUXT_PILOT_LOGIN_URL) {
      beforeFiles.push(
        { source: "/login", destination: `${NUXT_PILOT_LOGIN_URL}/dashboard/login` },
        { source: "/login/:path*", destination: `${NUXT_PILOT_LOGIN_URL}/dashboard/login/:path*` },
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
