# Piloto Guardados — Vue/Nuxt ("Aurora")

App Nuxt independiente que reimplementa el módulo **Guardados Transporte** como piloto de
migración de stack (Next.js/React → Vue/Nuxt) y de un nuevo lenguaje visual. Ver
`docs/cerebro/decisiones.md` (2026-07-03) para el contexto completo.

## Correr en desarrollo

```bash
npm install
npx prisma generate
npm run dev        # http://localhost:3001
```

Sin credenciales de base de datos, el piloto carga automáticamente en **modo demo** (datos
de ejemplo, tag ámbar "Modo demo" visible en el header). No escribe nada en la DB real.

## Conectar datos reales

1. Copia `.env.example` → `.env` y completa:
   - `DATABASE_URL` — misma conexión Postgres (Railway) que la app Next.js.
   - `NEXTAUTH_SECRET` — **el mismo secreto** que usa la app Next.js para firmar el JWT de
     Auth.js v5 (así el piloto puede leer la sesión sin un login separado).
2. Inicia sesión en la app Next.js (`localhost:3000`) en el mismo navegador — la cookie de
   sesión (`authjs.session-token`) es válida también para el piloto.
3. Reinicia `npm run dev`. El tag "Modo demo" desaparece; los datos y las acciones
   (crear/editar/despachar/eliminar/contactos) leen y escriben en la base real.

## Reemplazo de la ruta real (`next.config.ts`)

La app Next.js tiene un rewrite **condicional** que reemplaza `/dashboard/transporte`
(la ruta real, no una de preview) por este piloto: solo se activa si la variable de entorno
`NUXT_PILOT_URL` está definida. Sin ella (caso normal hoy), no se agrega ningún rewrite y la
página React original (`src/app/(dashboard)/dashboard/transporte/page.tsx`) sigue sirviendo
normalmente — cero cambio de comportamiento.

Usa la forma `beforeFiles` a propósito: un array de rewrites simple se evalúa *después* de
las páginas del filesystem, así que la página React seguiría ganando siempre. Con
`beforeFiles`, el proxy intercepta la petición antes de que Next.js resuelva la página.

Para probar en local:

```bash
# Terminal 1 — piloto Nuxt
npm run dev --prefix nuxt-app        # puerto 3001

# Terminal 2 — app Next.js con el rewrite activado
NUXT_PILOT_URL=http://localhost:3001 npm run dev
```

Con eso, `http://localhost:3000/dashboard/transporte` sirve el piloto Nuxt (Aurora) en vez de
la página React — mismo dominio, mismo middleware de autenticación (`src/middleware.ts` ya
protege `/dashboard/:path*`).

### Activar en producción

1. Desplegar `nuxt-app/` como proyecto Vercel propio (ya hecho:
   `nuxt-app-chi-ivory.vercel.app`).
2. En ese proyecto, configurar `DATABASE_URL` y `NEXTAUTH_SECRET` — **los mismos valores**
   que usa el proyecto principal (Settings → Environment Variables → copiar). Sin esto, los
   usuarios reales verían datos de ejemplo (modo demo) en vez de sus guardados reales.
3. En el proyecto principal (`almacen-sistema`), configurar `NUXT_PILOT_URL` apuntando a la
   URL del paso 1, y redeploy.
4. Verificar con datos reales antes de dar por completado el reemplazo. Revertir es
   instantáneo: basta con borrar `NUXT_PILOT_URL` del proyecto principal.

### Patrón para migrar los siguientes módulos

1. Construir el módulo en Nuxt (UI + endpoints Nitro que porten la lógica de `src/lib/*`).
2. Agregar su propio rewrite `beforeFiles` condicional en `next.config.ts` sobre su ruta real.
3. Desplegarlo como proyecto Vercel propio y validarlo contra la misma base de datos.
4. Activar su variable de entorno en producción cuando esté verificado con datos reales.

## Estructura

- `app/` — UI Vue: `app.vue` (shell + orquestación), `components/*.vue`, `utils/*.ts` (lógica
  de negocio portada: `guardado.ts`, `almacenaje.ts`), `assets/tokens.css` (design tokens).
- `server/api/transporte/*` — endpoints Nitro (espejo de `src/app/api/transporte/*`).
- `server/utils/` — `auth.ts` (verificación JWT), `prisma.ts`, `permissions.ts`.
- `prisma/schema.prisma` — copia del schema raíz (misma DB, sin migrations propias).
