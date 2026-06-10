## Cerebro del proyecto

> **Antes de modificar cualquier código**, lee estos archivos en orden:
>
> 1. `docs/cerebro/00-master-context.md` — qué es el proyecto, stack, arquitectura
> 2. `docs/cerebro/reglas-negocio.md` — reglas operativas, flujo principal, validaciones
> 3. `docs/cerebro/roles-permisos.md` — los 12 roles y qué módulos ve cada uno
> 4. `docs/cerebro/flujo-despachos.md` — ciclo de vida de un despacho
> 5. `docs/cerebro/estados-despacho.md` — estados reales en DB y estados deseados
> 6. `docs/cerebro/decisiones.md` — decisiones arquitectónicas con fecha y contexto
> 7. `docs/cerebro/pendientes.md` — tareas pendientes y completadas
> 8. `docs/cerebro/bugs.md` — bugs abiertos y su estado

@AGENTS.md

# Proyecto: Sistema de Gestión de Almacén — Grupo Ambiente

> **Antes de trabajar, lee `HANDOFF.md`** (en la raíz). Contiene el estado completo:
> arquitectura, seguridad, permisos por rol, auditoría, identidad visual y pendientes.

## Qué es
App web interna de **Grupo Ambiente** para gestionar inventario y logística. Módulos activos:
**Novedades Inventario**, **Guardados Transporte**, **Despachos Tienda** y **Preoperacional** (conductores).
Reemplaza una versión vieja de HTML + Sheets.

> ⚠️ **Logística (rutas GPS) y Mi Ruta están deshabilitados** en Sprint 8. No reactivar.

## Stack
Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · TailwindCSS v4 + CSS vars ·
Auth.js v5 (JWT, roles) · Prisma 7 (`@prisma/adapter-pg`) · PostgreSQL en Railway · Vercel.

⚠️ Este Next.js trae cambios de ruptura (ver `AGENTS.md`): consulta `node_modules/next/dist/docs/`
antes de tocar APIs/convenciones que no conozcas.

## Mapa rápido
- `src/lib/authz.ts` — `requireAuth` / `requireRole` / `requireCan` (autorización server-side).
- `src/lib/permissions.ts` — matriz `can(role, action)` (fuente única; úsala en API y UI).
- `src/lib/modulePermissions.ts` — visibilidad de módulos por rol (`canSeeModule`).
- `src/app/api/*` — endpoints (GET ver, POST crear, PUT editar, DELETE eliminar).
- `src/app/api/users/vehiculos` · `transportistas-operativos` · `transportistas-disponibles` — gestión de flota (ADMIN).
- `src/app/api/preoperacional` — inspección diaria del conductor (TRANSPORTISTA).
- `src/app/(dashboard)/dashboard/*` — páginas: inventario, tienda, transporte, preoperacional, usuarios, auditoria.
- `src/components/common/Logo.tsx` — wordmark `/logo.png` (se invierte a blanco en oscuro).
- `src/app/globals.css` — tokens de marca (azules intensos), dark mode, utilidades.

## Roles activos (Sprint 8)
| Rol | Ve |
|-----|----|
| ADMIN | Todo + Usuarios + Auditoría |
| GERENTE | Todo operativo + Centro de Control |
| SUPERVISOR_TIENDA | Tienda + Centro de Control |
| SUPERVISOR_TRANSPORTE | Tienda + Guardados + Centro de Control |
| SUPERVISOR_INVENTARIO | Inventario + Conteo + Centro de Control |
| TIENDA | Solo Despachos Tienda |
| TRANSPORTE | Solo Guardados |
| INVENTARIO | Solo Inventario + Conteo |
| TRANSPORTISTA | **Solo Preoperacional** (requiere transportista operativo con vehículo asignado) |
| OPERADOR | Inventario + Transporte (rol legado) |

Vehículos y transportistas operativos se gestionan desde **Usuarios** (solo ADMIN).
Se valida en servidor (`requireCan`) **y** en UI (ocultar botones). No confiar nunca solo en el cliente.

## Identidad visual
Marca **Grupo Ambiente**. Paleta de **azules intensos** (sin pastel): Muebles=azul, Transporte=cian.
Verde/rojo/ámbar reservados para significado (solucionado/pendiente/alerta). Logo en `public/logo.png`.

## Comandos
- Dev: `npm run dev` · Build: `npm run build` · Type-check: `npx tsc --noEmit`
- Tests: `npm test` · Schema a DB: `npx prisma db push` · Crear admin: `node prisma/seed.js`
- **Deploy prod: `git push origin master`** → GitHub Actions hace tsc + tests + `vercel deploy --prod` automáticamente.
- Deploy preview manual: `vercel deploy --yes --token <TOKEN>` (con `.vercel/project.json` enlazado).

## Reglas de trabajo
- **Nunca** pongas contraseñas/tokens/cadenas de conexión en archivos versionados (`.env*` y `.vercel/` están en `.gitignore`).
- Commits cortos y descriptivos. Rama de trabajo: `master`. Remoto: `origin` (GitHub).
- Tras cambios, valida con `npx tsc --noEmit` y `npm test` antes de hacer push.
