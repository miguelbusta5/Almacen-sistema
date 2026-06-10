<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-agent-rules -->
# Instrucciones para agentes (Codex / Claude / otros)

## Leer antes de cualquier cambio de código

1. `docs/cerebro/00-master-context.md` — stack, arquitectura, URL de producción
2. `docs/cerebro/reglas-negocio.md` — flujo principal, validaciones, módulos suspendidos
3. `docs/cerebro/roles-permisos.md` — los 12 roles y sus permisos
4. `docs/cerebro/flujo-despachos.md` — estados y transiciones de despachos
5. `docs/cerebro/estados-despacho.md` — enums reales en DB vs. estados deseados
6. `docs/cerebro/decisiones.md` — decisiones con contexto y fecha
7. `docs/cerebro/pendientes.md` — tareas activas
8. `docs/cerebro/bugs.md` — bugs abiertos

## Reglas no negociables

- **NUNCA reactivar** logística, rutas, GPS ni "Mi Ruta" — están suspendidos indefinidamente
- **Siempre doble validación:** server (`requireCan` / `requireRole`) + UI (`canSeeModule`)
- **NUNCA** poner credenciales, tokens ni cadenas de conexión en archivos versionados
- **Siempre validar antes de push:** `npx tsc --noEmit` → `npm test` → `git push origin master`
- **No usar migrations de Prisma** — usar `npx prisma db push` + `npx prisma generate`
- **Commits cortos y descriptivos** en español o inglés, rama `master`

## Fuentes de verdad

| Qué | Archivo |
|---|---|
| Roles y permisos CRUD | `src/lib/permissions.ts` |
| Visibilidad de módulos | `src/lib/modulePermissions.ts` |
| Tipos TypeScript | `src/types/index.ts` |
| Schema de BD | `prisma/schema.prisma` |
| Navegación | `src/components/common/Sidebar.tsx` |
| Acciones del home | `src/config/homeActions.ts` |

## Stack

Next.js 16 · React 19 · TypeScript · Prisma 7 · PostgreSQL (Railway) · Vercel
<!-- END:project-agent-rules -->
