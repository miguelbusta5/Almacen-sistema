# 00 · Master Context — Sistema de Gestión CEDI

> **Archivo de entrada.** Leer primero en cualquier conversación nueva.
> Links internos: [[reglas-negocio]] · [[roles-permisos]] · [[modulos]] · [[base-datos]] · [[decisiones]]

---

## Qué es este proyecto

Aplicación web operativa interna de **Grupo Ambiente** para gestionar inventario, logística y despachos desde tienda hasta cliente. Reemplaza una solución previa en HTML + Google Sheets.

- **Área responsable:** Analista de inventario (quien construye la app)
- **Usuarios finales:** Personal operativo de tienda, transporte, inventario, conductores y gerencia
- **Sistema externo relacionado:** NetSuite (ERP de la empresa — fuente de IDs de productos y documentos)

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
└── __tests__/                 # Tests con Vitest (221 tests activos)
```

---

## Comandos esenciales

```bash
npm run dev          # Desarrollo local (Turbopack)
npm run build        # Build de producción
npx tsc --noEmit     # Verificar tipos (obligatorio antes de push)
npm test             # Vitest (221 tests)
npx prisma db push   # Aplicar cambios del schema a Railway
npx prisma generate  # Regenerar cliente Prisma (después de editar schema.prisma)
node prisma/seed.js  # Crear usuario admin inicial
git push origin master  # Deploy a producción (CI/CD automático)
```

---

## Identidad visual

- **Marca:** Grupo Ambiente
- **Nombre operativo UI:** Torre CEDI
- **Paleta:** Azules intensos — sin pasteles
  - Muebles/Inventario: `#2563EB`
  - Transporte: `#0E7490`
  - Tienda: `#D97706`
  - Integración de Pedidos: `#7C3AED`
  - Verde/Rojo/Ámbar: solo para significado semántico (éxito/error/alerta)
- **Tema modular:** `src/lib/moduleTheme.ts`
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
