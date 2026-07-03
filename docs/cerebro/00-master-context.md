# 00 · Master Context — Sistema de Gestión CEDI

> **Archivo de entrada.** Leer primero en cualquier conversación nueva.
> Links internos: [[reglas-negocio]] · [[roles-permisos]] · [[modulos]] · [[base-datos]] · [[decisiones]]

---

## Qué es este proyecto

Aplicación web operativa interna de **Grupo Ambiente** para gestionar inventario, facturas contado, solicitudes de transporte, transporte, preoperacional, conteo e integración operativa. Reemplaza una solución previa en HTML + Google Sheets.

- **Área responsable:** Analista de inventario (quien construye la app)
- **Usuarios finales:** Personal operativo de tienda, transporte, inventario, conductores y gerencia
- **Sistema externo relacionado:** NetSuite (ERP de la empresa — fuente de IDs de productos y documentos)

> Logística avanzada, rutas, GPS y "Mi Ruta" están suspendidos indefinidamente. No forman parte del flujo activo.

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19 + TypeScript |
| Estilos | TailwindCSS v4 + CSS custom properties |
| Autenticación | Auth.js v5 (JWT, roles en sesión) |
| ORM | Prisma 7 con `@prisma/adapter-pg` |
| Base de datos | PostgreSQL en Railway |
| Deploy | Vercel (producción automática via GitHub Actions) |
| CI/CD | GitHub Actions: tsc + vitest + `vercel deploy --prod` |

**URL producción:** `matec-cedi.vercel.app`
**Rama principal:** `master` → push = deploy automático

> ⚠️ **Excepción de stack (desde 2026-07-03):** `/dashboard/transporte` (Guardados) ya **no**
> sirve la página React de arriba — Next.js la reescribe (`next.config.ts`, `beforeFiles`,
> gateado por `NUXT_PILOT_URL`) hacia una app **Vue/Nuxt 4 + Nitro** independiente en
> `nuxt-app/` (proyecto Vercel aparte: `nuxt-app-chi-ivory.vercel.app`), primer piloto de una
> migración completa de stack. Comparte la misma DB (Railway) y la misma cookie JWT de
> Auth.js v5. Ver [[decisiones]] (2026-07-03) para el detalle completo y [[modulos]].

---

## Arquitectura clave

```
src/
├── app/
│   ├── (auth)/login/          # Login con Auth.js
│   ├── (dashboard)/dashboard/ # Todas las páginas protegidas
│   └── api/                   # API Routes (Next.js Route Handlers)
├── lib/
│   ├── authz.ts               # requireAuth / requireRole / requireCan
│   ├── permissions.ts         # Matriz CRUD por rol (ROLE_LABEL aquí)
│   ├── modulePermissions.ts   # Visibilidad de módulos por rol
│   └── prisma.ts              # Cliente Prisma singleton
├── components/
│   ├── common/Sidebar.tsx     # Navegación filtrada por rol
│   └── ui/                    # Design system (Badge, SlidePanel, etc.)
├── types/index.ts             # UserRole, AppUser, interfaces compartidas
└── __tests__/                 # Tests con Vitest (251 tests activos)
```

---

## Comandos esenciales

```bash
npm run dev          # Desarrollo local (Turbopack)
npm run build        # Build de producción
npx tsc --noEmit     # Verificar tipos (obligatorio antes de push)
npm test             # Vitest (251 tests)
npx prisma db push   # Aplicar cambios del schema a Railway
npx prisma generate  # Regenerar cliente Prisma (después de editar schema.prisma)
node prisma/seed.js  # Crear usuario admin inicial
git push origin master  # Deploy a producción (CI/CD automático)
```

---

## Identidad visual

> Vigente desde 2026-06-19: **Dark Elegant (Obsidiana + Esmeralda)**. Solo modo oscuro, un unico acento esmeralda, estados con color propio, encabezados sin imagenes. Ver [[ux-ui]] para la paleta completa.

- **Marca:** Grupo Ambiente
- **Nombre operativo UI:** Control Logistico CEDI
- **Dirección:** dark elegant sobrio (obsidiana casi negra) con un solo acento esmeralda vivo reservado a accion/foco/estado activo
- **Solo oscuro:** se elimino el tema claro, el `ThemeToggle` y el script de init de tema. `:root` es el tema oscuro y `<html data-theme="dark">` se fija como salvaguarda.
- **Acento unico:** los modulos NO se diferencian por color (se distinguen por icono y tipografia). `src/lib/moduleTheme.ts` resuelve todos los modulos a esmeralda; ya no usa `heroImage`.
- **Estados operativos** (rechazado, pendiente, recogido, entregado, enviado, efectuado, bloqueado) **si tienen color propio** y vivo, via tokens `--state-*` y variantes de `Badge`/`DataTable`.
- **Sin imagenes en encabezados:** `ModuleHero` es puramente tipografico (sin asset). `public/ui/module-heroes/` ya no se referencia.
- **Componentes visuales:** `src/components/ui/cedi.tsx`, `pageShell.tsx`, `DataTable.tsx`, `SlidePanel.tsx`, `ModuleHero.tsx`, `charts.tsx`.
- **Indicadores externos:** Google Sheets se sincroniza a PostgreSQL; no se consulta desde el cliente.
- **Logo:** `public/logo.png` — se invierte a blanco sobre fondo oscuro
- **Tipografía:** `Inter` (UI) + `Sora` (display, `--display`/`--logo`) + `JetBrains Mono` (`--mono`), via `<link>` en `layout.tsx`

---

## Reglas de seguridad no negociables

- Nunca credenciales, tokens ni conexiones en archivos versionados
- `.env*` y `.vercel/` están en `.gitignore` — no agregarlos
- Siempre validar en servidor (`requireCan`) + ocultar en UI
- Nunca confiar solo en el cliente para control de acceso

---

## Cómo usar este cerebro en Obsidian

1. Abrir `c:\Users\USUARIO\Desktop\almacen-sistema` como vault en Obsidian
2. Activar Graph View para ver conexiones entre notas
3. Este archivo (`00-master-context.md`) es el nodo raíz
4. Usar `[[doble corchete]]` para navegar entre archivos del cerebro
