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

> Vigente desde 2026-06-18: **Colorido Completo Enterprise**. Usar color por modulo y color por estado con base clara/oscura premium. El azul ya no limita toda la interfaz.

- **Marca:** Grupo Ambiente
- **Nombre operativo UI:** Control Logistico CEDI
- **Dirección:** interfaz enterprise viva tipo Vercel/Linear/Supabase/Notion, con identidad operativa CEDI
- **Tema modular:** `src/lib/moduleTheme.ts`
  - Cada módulo define `color`, `tint`, `gradient`, `darkColor`, `darkTint` y contraste
  - El color se aplica a navegación, encabezados, KPIs, tabs, rails de tabla, drawers y acciones principales
- **Estados operativos:** rechazado, pendiente, recogido, entregado, enviado, efectuado y bloqueado tienen color propio independiente del módulo
- **Componentes visuales nuevos:** `src/components/ui/cedi.tsx`, `src/components/ui/pageShell.tsx`, `src/components/ui/DataTable.tsx`, `src/components/ui/SlidePanel.tsx`
- **Indicadores externos:** Google Sheets se sincroniza a PostgreSQL; no se consulta desde el cliente.
- **Logo:** `public/logo.png` — se invierte a blanco en modo oscuro
- **Tipografía:** Variable CSS `--sans` (sistema) y `--mono` (código)

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
