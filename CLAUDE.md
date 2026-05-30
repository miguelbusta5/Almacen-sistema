@AGENTS.md

# Proyecto: Sistema de Gestión de Almacén — Grupo Ambiente

> **Antes de trabajar, lee `HANDOFF.md`** (en la raíz). Contiene el estado completo:
> arquitectura, seguridad, permisos por rol, auditoría, identidad visual y pendientes.

## Qué es
App web interna de **Grupo Ambiente** para gestionar inventario y logística. Dos módulos:
**Novedades Muebles** y **Guardados Transporte**. Reemplaza una versión vieja de HTML + Sheets.

## Stack
Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · TailwindCSS v4 + CSS vars ·
Auth.js v5 (JWT, roles) · Prisma 7 (`@prisma/adapter-pg`) · PostgreSQL en Railway · Vercel.

⚠️ Este Next.js trae cambios de ruptura (ver `AGENTS.md`): consulta `node_modules/next/dist/docs/`
antes de tocar APIs/convenciones que no conozcas.

## Mapa rápido
- `src/lib/authz.ts` — `requireAuth` / `requireRole` / `requireCan` (autorización server-side).
- `src/lib/permissions.ts` — matriz `can(role, action)` (fuente única; úsala en API y UI).
- `src/app/api/*` — endpoints (GET ver, POST crear, PUT editar, DELETE eliminar).
- `src/app/(dashboard)/dashboard/*` — páginas: muebles, transporte, usuarios, auditoria.
- `src/components/common/Logo.tsx` — wordmark `/logo.png` (se invierte a blanco en oscuro).
- `src/app/globals.css` — tokens de marca (azules intensos), dark mode, utilidades.

## Permisos por rol
OPERADOR: ver + crear · GERENTE: + editar · ADMIN: + eliminar / usuarios / auditoría.
Se valida en servidor (`requireCan`) **y** en UI (ocultar botones). No confiar nunca solo en el cliente.

## Identidad visual
Marca **Grupo Ambiente**. Paleta de **azules intensos** (sin pastel): Muebles=azul, Transporte=cian.
Verde/rojo/ámbar reservados para significado (solucionado/pendiente/alerta). Logo en `public/logo.png`.

## Comandos
- Dev: `npm run dev` · Build: `npm run build` · Type-check: `npx tsc --noEmit`
- Schema a DB: `npx prisma db push` · Crear admin: `node prisma/seed.js` (lee `ADMIN_*` del entorno)
- Deploy prod: `vercel deploy --prod --yes --token <TOKEN>` · Preview: `vercel deploy --yes --token <TOKEN>`
  (el proyecto **no** está conectado a GitHub en Vercel; deploys manuales por CLI)

## Reglas de trabajo
- **Nunca** pongas contraseñas/tokens/cadenas de conexión en archivos versionados (`.env*` y `.vercel/` están en `.gitignore`).
- Commits cortos y descriptivos (es lo que se ha venido usando). Rama de trabajo: `master`. Remoto: `origin` (GitHub).
- Tras cambios, valida con `npx tsc --noEmit` y `npm run build` antes de desplegar.
- Acciones pendientes del dueño: cambiar contraseña del admin (pantalla Usuarios); revocar tokens de Vercel temporales.
