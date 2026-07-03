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

## Coexistencia con la app Next.js (`next.config.ts`)

La app Next.js tiene un rewrite **condicional**: solo existe si la variable de entorno
`NUXT_PILOT_URL` está definida. Sin ella (caso normal de producción hoy), `rewrites()`
devuelve `[]` — no se agrega ninguna ruta y no hay ningún cambio de comportamiento.

Para probar la coexistencia en local:

```bash
# Terminal 1 — piloto Nuxt
npm run dev --prefix nuxt-app        # puerto 3001

# Terminal 2 — app Next.js con el rewrite activado
NUXT_PILOT_URL=http://localhost:3001 npm run dev
```

Con eso, `http://localhost:3000/dashboard/transporte-piloto` sirve el piloto Nuxt **a
través** de la app Next.js — mismo dominio, mismo middleware de autenticación
(`src/middleware.ts` ya protege `/dashboard/:path*`, incluida esta ruta), sin afectar
`/dashboard/transporte` (la página React original sigue intacta como fallback).

### Patrón para migrar los siguientes módulos

1. Construir el módulo en Nuxt (UI + endpoints Nitro que porten la lógica de `src/lib/*`).
2. Agregar su propio rewrite condicional en `next.config.ts` bajo una ruta `-piloto`.
3. Validar en paralelo contra la misma base de datos que la versión Next.js.
4. Cuando el módulo esté aprobado: el rewrite pasa a ser incondicional (o se apunta a la
   URL de producción del deploy Nuxt) y la página Next.js equivalente se retira.

## Estructura

- `app/` — UI Vue: `app.vue` (shell + orquestación), `components/*.vue`, `utils/*.ts` (lógica
  de negocio portada: `guardado.ts`, `almacenaje.ts`), `assets/tokens.css` (design tokens).
- `server/api/transporte/*` — endpoints Nitro (espejo de `src/app/api/transporte/*`).
- `server/utils/` — `auth.ts` (verificación JWT), `prisma.ts`, `permissions.ts`.
- `prisma/schema.prisma` — copia del schema raíz (misma DB, sin migrations propias).
