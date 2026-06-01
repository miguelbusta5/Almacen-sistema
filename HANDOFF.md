# 📦 HANDOFF — Sistema de Gestión de Almacén (Grupo Ambiente)

> Documento de traspaso técnico. Última actualización: 2026-05-30 (sesión 2).
>
> ⚠️ **Nunca pongas contraseñas, tokens ni cadenas de conexión en este archivo** (está versionado en git). Usa solo nombres de variables de entorno.

---

## 1. Objetivo del proyecto

Plataforma web interna para la gestión de inventario y logística del almacén de **Grupo Ambiente**, que reemplaza una versión anterior basada en HTML estático + Google Sheets + localStorage.

Centraliza dos operaciones del negocio:

- **Novedades Muebles** — registro y seguimiento de diferencias de inventario (faltantes/sobrantes) por PLU, posición y fabricante, con su impacto económico.
- **Guardados Transporte** — control de pedidos guardados de clientes, con cálculo automático de cobro de almacenaje y alertas de entrega.

Requisitos clave: usuarios con roles/permisos, sincronización multi-dispositivo (una sola fuente de verdad en BD), mantenibilidad a 2+ años, y acceso desde cualquier dispositivo (móvil/PC).

> Nota de nombres de infraestructura: por historia, el **proyecto de Vercel** se llama `almacen-sistema` bajo el team `matec` y el alias de producción es `matec-cedi.vercel.app`. La **marca del producto** es **Grupo Ambiente** (es lo que ve el usuario).

---

## 2. Arquitectura actual

```
┌─────────────────────────────────────────────────────────────┐
│  CLIENTE (navegador móvil / PC)                              │
│  Next.js App Router · React 19 · Client Components           │
└───────────────┬─────────────────────────────────────────────┘
                │ HTTPS
┌───────────────▼─────────────────────────────────────────────┐
│  VERCEL (serverless) — matec-cedi.vercel.app                 │
│  ├─ Páginas SSR/CSR (App Router, route groups)               │
│  ├─ API Routes (/api/*) — lógica de negocio + auth + roles   │
│  └─ Auth.js v5 (sesiones JWT, credenciales)                  │
└───────────────┬─────────────────────────────────────────────┘
                │ Prisma + @prisma/adapter-pg (pool SSL)
┌───────────────▼─────────────────────────────────────────────┐
│  RAILWAY — PostgreSQL (proyecto chic-illumination)          │
│  Tablas: users, activity_logs, novedades,                    │
│          transporte_guardados, transporte_deleted            │
└─────────────────────────────────────────────────────────────┘
```

### Estructura de carpetas (relevante)

```
public/
└─ logo.png                   # Wordmark Grupo Ambiente (WebP 356x131, transparente)
src/
├─ app/
│  ├─ layout.tsx              # Root layout + fuentes (Archivo/Syne/DM Mono) + anti-flash tema
│  ├─ page.tsx                # Raíz → redirige a /login o /dashboard
│  ├─ globals.css             # Design system (tokens de marca, dark mode, utilidades)
│  ├─ (auth)/login/page.tsx   # Login con identidad Grupo Ambiente
│  ├─ (dashboard)/dashboard/
│  │  ├─ layout.tsx           # Guard de sesión + Sidebar + Header
│  │  ├─ page.tsx             # Panel principal (saludo + KPIs vivos + cards de módulo)
│  │  ├─ muebles/page.tsx     # Módulo Novedades Muebles
│  │  ├─ transporte/page.tsx  # Módulo Guardados Transporte
│  │  ├─ usuarios/page.tsx    # Gestión de usuarios (solo ADMIN)
│  │  └─ auditoria/page.tsx   # Auditoría / activity_logs (solo ADMIN)  ← NUEVO
│  └─ api/
│     ├─ auth/[...nextauth]/  # Handlers Auth.js v5
│     ├─ novedades/           # GET, POST  +  [id]/ PUT, DELETE
│     ├─ transporte/          # GET, POST  +  [clientId]/ PUT, DELETE (tombstone)
│     ├─ users/               # GET, POST  +  [id]/ PUT  (solo ADMIN)
│     ├─ activity/            # GET (solo ADMIN) — auditoría con filtros + paginación  ← NUEVO
│     └─ stats/               # KPIs del panel principal
├─ components/common/
│  ├─ Logo.tsx                # Wordmark; invierte a blanco en fondos oscuros (CSS)  ← NUEVO
│  ├─ Sidebar.tsx             # Sidebar (logo, iconos lucide, activo con acento azul)
│  ├─ Header.tsx              # Header + tema + logout
│  ├─ ThemeToggle.tsx         # Claro/oscuro
│  └─ Providers.tsx           # SessionProvider de Auth.js
├─ lib/
│  ├─ prisma.ts               # Cliente Prisma singleton (adapter-pg + Pool SSL)
│  ├─ auth.ts                 # Config Auth.js v5 (credenciales, JWT, roles)
│  ├─ authz.ts                # getSessionUser / requireAuth / requireRole / requireCan  ← NUEVO
│  ├─ permissions.ts          # Matriz can(role, accion) — pura, server + cliente        ← NUEVO
│  ├─ almacenaje.ts           # Lógica de cobro de almacenaje (gracia + $150k/mes)
│  ├─ muebles.ts / transporte.ts / useIsMobile.ts / utils.ts
prisma/
├─ schema.prisma              # Modelos
└─ seed.js                    # Crea admin inicial — lee credenciales SOLO de entorno
```

### Patrones clave

- **Protección de rutas:** el `layout.tsx` del dashboard es un Server Component que llama a `auth()` y redirige a `/login` si no hay sesión.
- **Autorización por rol (server-side):** `src/lib/authz.ts` expone `requireAuth()`, `requireRole([...])` y `requireCan(action)`. Las APIs devuelven 401/403 reales — la seguridad **no** depende del cliente.
- **Matriz de permisos:** `src/lib/permissions.ts` (`can(role, action)`) es la fuente única de verdad, usada por las APIs y por la UI (para ocultar botones).
- **Modales con React Portal:** se renderizan en `document.body` (z-index alto) para escapar transforms y headers sticky.
- **Borrado a prueba de resurrección (transporte):** al borrar se inserta el `client_id` en `transporte_deleted` (tombstone).
- **Auditoría:** cada CREATE/UPDATE/DELETE registra una fila en `activity_logs` (quién, qué, cuándo) — visible en `/dashboard/auditoria`.

---

## 3. Tecnologías utilizadas

| Capa | Tecnología | Versión | Notas |
|------|-----------|---------|-------|
| Framework | Next.js (App Router) | 16.2.6 | Turbopack |
| UI | React | 19.x | |
| Lenguaje | TypeScript | 5.x | Type-check limpio |
| Estilos | TailwindCSS v4 + CSS vars | 4 | Tokens de marca en `globals.css` |
| Auth | Auth.js (next-auth) | 5.0.0-beta | Credenciales, JWT, roles |
| ORM | Prisma | 7.x | con `@prisma/adapter-pg` + `pg` |
| Base de datos | PostgreSQL (Railway) | — | URL pública con SSL |
| Validación | Zod | 4.x | |
| Gráficos | Chart.js + react-chartjs-2 | 4.x / 5.x | Doughnut, Bar, Line |
| Iconos | lucide-react | 1.x | |
| Tipografía | Archivo (logo), Syne (UI), DM Mono (datos) | — | Google Fonts |
| Hash | bcryptjs | 3.x | rounds 12 |
| Hosting | Vercel | — | team `matec`, proyecto `almacen-sistema` |

**Variables de entorno:**
- Producción (Vercel): `DATABASE_URL`, `NEXTAUTH_SECRET`, `AUTH_SECRET`.
- Local (`.env.local`, no se commitea): `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `NEXT_PUBLIC_API_URL`.
- El **seed** (`prisma/seed.js`) lee `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` del entorno; **ya no hay credenciales hardcodeadas**.

---

## 4. Modelo de permisos por rol

| Acción | OPERADOR | GERENTE | ADMIN |
|--------|:--:|:--:|:--:|
| Ver dashboards / listas (GET) | ✅ | ✅ | ✅ |
| Registrar (crear) | ✅ | ✅ | ✅ |
| Editar | ❌ | ✅ | ✅ |
| Eliminar | ❌ | ❌ | ✅ |
| Gestionar usuarios | ❌ | ❌ | ✅ |
| Ver auditoría | ❌ | ❌ | ✅ |

Se aplica en **servidor** (`requireCan` en cada API) y en **UI** (botones Editar/Eliminar ocultos según rol). Para cambiar el modelo, edita la matriz en `src/lib/permissions.ts`.

---

## 5. Funcionalidades implementadas

### Autenticación y usuarios
- ✅ Login email + contraseña (Auth.js v5, JWT 8h), emails insensibles a mayúsculas.
- ✅ Roles `ADMIN` / `GERENTE` / `OPERADOR` con permisos finos (ver §4).
- ✅ Gestión de usuarios (solo ADMIN): crear, editar nombre/rol/estado, resetear contraseña.
- ✅ Protección anti-autobloqueo del admin.

### Seguridad (endurecida en esta entrega)
- ✅ **Autorización por rol server-side** (`authz.ts` + `permissions.ts`); las APIs ya no confían en el cliente.
- ✅ **Eliminado el `DELETE_PIN "0000"`** (era validación solo-cliente). El borrado ahora requiere rol ADMIN en el servidor; el botón se oculta a no-ADMIN y el modal es una confirmación real.
- ✅ **Sin credenciales hardcodeadas**: `seed.js` lee del entorno (antes tenía la contraseña de Postgres y la del admin en el código).
- ✅ **Contraseña de PostgreSQL rotada** (la anterior quedó expuesta en el historial de git). La nueva vive solo en `.env.local` y en Vercel.

### Módulo Novedades Muebles
- ✅ Dashboard con KPIs e impacto económico; gráficos (donut, línea, barras); lista con filtros; CRUD; detalle; histórico importado.

### Módulo Guardados Transporte
- ✅ Dashboard con KPIs; alertas de entrega; cobros de almacenaje (gracia + $150k/mes); lista; CRUD + marcar despachado; borrado con tombstone.

### Auditoría
- ✅ `/dashboard/auditoria` (solo ADMIN): tabla de `activity_logs` con usuario, acción, módulo, registro y detalle; filtros (módulo/acción/usuario/fechas/búsqueda) y paginación.
- ✅ **Exportar CSV** — botón en cabecera, descarga todos los registros filtrados (hasta 5.000) como CSV UTF-8 con BOM (abre bien en Excel).

### Pulido visual (sesión 2)
- ✅ **Skeletons shimmer** en la carga inicial de Muebles y Transporte (imitan KPIs + gráficos).
- ✅ **Tooltips personalizados** en gráficos: Donut con %, Línea con unidades, Barras de impacto con COP.
- ✅ **Ordenamiento por columna** en tablas de Muebles (8 cols) y Transporte (6 cols incl. almacenaje y alerta calculados). Clic → asc; segundo clic → desc. Acento de color por módulo.

### Calidad (sesión 2)
- ✅ **Tests unitarios** (Vitest) — 56 tests cubriendo `permissions.ts`, `almacenaje.ts`, `muebles.ts`, `transporte.ts` y `logistica.ts`. `npm test`.
- ✅ **GitHub Actions CI** — type-check + tests en cada push/PR a `master` (`.github/workflows/ci.yml`).

### Módulo Logística (sesión 3)
- ✅ **5 tablas nuevas**: `vehiculos`, `transportistas`, `rutas`, `paradas`, `ubicaciones_gps`.
- ✅ **Gestión de flota**: CRUD de vehículos (placa, tipo, capacidad, estado) y transportistas (nombre, teléfono, vehículo asignado, cuenta de usuario opcional).
- ✅ **Gestión de rutas**: crear ruta con paradas, asignar conductor, estados (Pendiente → En curso → Finalizada / Cancelada), progreso por parada.
- ✅ **Optimización de ruta**: botón ⚡ Optimizar reordena las paradas automáticamente con el algoritmo **Nearest Neighbor** (Haversine) si todas tienen coordenadas GPS.
- ✅ **Confirmación de entrega**: cada parada puede marcarse como Entregado / No entregado; registra hora, GPS del conductor y observaciones. Si la parada tiene `pedidoId`, auto-marca el pedido de Transporte como DESPACHADO.
- ✅ **Mapa en tiempo real**: panel supervisor con mapa Leaflet (OpenStreetMap); muestra posición de cada conductor activo con polling cada 30 s.
- ✅ **Vista conductor** (`/dashboard/logistica/mi-ruta`): muestra la ruta asignada del día, envía GPS automáticamente cada 30 s, botón "Iniciar navegación" → Google Maps, confirmación desde bottom sheet optimizado para móvil.
- ✅ **Permiso nuevo** `manageLogistica` (GERENTE + ADMIN) en `permissions.ts`.
- ✅ **Color del módulo**: violeta `#7c3aed`, familia fría distinta de azul (Muebles) y cian (Transporte).
- ✅ **Integración sidebar**: enlaces "Logística" y "Mi ruta" visibles según rol.

### UX / Diseño — Identidad Grupo Ambiente  ← NUEVO
- ✅ Paleta de **azules intensos** + base tinta (tokens en `globals.css`), dark mode afinado, focus-ring y sombras de marca.
- ✅ **Logo real** (`/logo.png`) con inversión a blanco por CSS en fondos oscuros; fuente Archivo para el wordmark.
- ✅ Login con panel de marca; sidebar con iconos lucide y acento azul; dashboard con saludo + KPIs vivos + cards de módulo.
- ✅ Módulos recoloreados: **Muebles azul**, **Transporte cian** (familia azul); semánticos (verde/rojo/ámbar) intactos.
- ✅ Microinteracciones: `lift` (hover elevado), `skeleton` (shimmer), `stagger`/`fade-up`, respeto a `prefers-reduced-motion`.

### Despliegue
- ✅ Producción: **https://matec-cedi.vercel.app**. Deploy CLI (`vercel deploy --prod`). El proyecto **no** está conectado a GitHub (deploys manuales por CLI).

---

## 6. Pendientes

- [x] **(Acción del dueño) Cambiar la contraseña del admin** — completado.
- [x] **Exportar auditoría a CSV** — botón en `/dashboard/auditoria`, respeta filtros activos, hasta 5.000 filas.
- [x] **Pulido visual de módulos** — skeletons shimmer en carga, tooltips personalizados en gráficos (COP, %), ordenamiento por columna en tablas (Muebles y Transporte).
- [x] **Tests unitarios** — Vitest (44 tests): permisos, almacenaje, utilidades de formato y parseEntrega. `npm test`.
- [x] **CI/CD** — GitHub Actions (`.github/workflows/ci.yml`): type-check + tests en cada push/PR a `master`.
- [x] **Módulo Logística** — rutas, GPS en tiempo real, mapa supervisor, vista conductor, optimización nearest-neighbor, confirmación de entrega.
- [x] **Foto de evidencia real** — subida a Vercel Blob desde el móvil del conductor; miniatura visible para supervisor. Columna `foto_url` en `paradas`.
- [~] **Recuperación de contraseña** — descartada por ahora. El admin restablece la contraseña manualmente desde la pantalla de Usuarios.
- [x] **Deploy automático desde GitHub** — GitHub Actions despliega a Vercel en cada push a `master` que pase los checks. Secretos en el repo: `VERCEL_TOKEN` (tipo `vcp_`, Full Account), `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. Nota: los valores deben guardarse sin newlines — usar `gh secret set --body "valor"`, nunca pipe desde PowerShell (añade BOM).
- [ ] **Pooling de DB** para escala (Prisma Accelerate / PgBouncer) si crece el tráfico.
- [ ] **Dominio propio** (.com) si se desea.

---

## 7. Bugs conocidos

| Estado | Descripción | Notas |
|--------|-------------|-------|
| ✅ Resuelto | Login de operadores fallaba | Emails normalizados a minúsculas. |
| ✅ Resuelto | Modal de detalle se cortaba por arriba | React Portal a `body` + z-index alto. |
| ✅ Resuelto | Credenciales filtradas en `seed.js` | Movidas a entorno + contraseña de Postgres rotada. |
| ✅ Resuelto | Borrado protegido solo por PIN de cliente | Ahora rol ADMIN server-side. |
| ⚠️ Menor | Advertencia de hidratación por `data-theme` | Script anti-flash; benigna. |
| ⚠️ Menor | `<img>` del logo (regla `no-img-element`) | Solo warning de lint; el archivo es WebP con extensión `.png` (se sirve bien). |

> No hay bugs abiertos críticos al momento del traspaso.

---

## 8. Datos de acceso y referencias

- **App producción:** https://matec-cedi.vercel.app
- **Credenciales:** en `.env.local` (local) y en Vercel (prod). **No se documentan aquí.** El admin inicial debe cambiar su contraseña tras el primer ingreso.
- **Proyecto Vercel:** team `matec` → `almacen-sistema` (`prj_xosOGb6BZ7iSaT5vv1TMlfjkx8pa`).
- **Base de datos:** Railway PostgreSQL (proyecto `chic-illumination`, host `roundhouse.proxy.rlwy.net`). La contraseña se gestiona en Railway (`POSTGRES_PASSWORD`) y debe coincidir con `DATABASE_URL`.
- **Repo local:** `C:\Users\USUARIO\Desktop\almacen-sistema` (git, branch `master`).
- **Comandos:**
  - Dev local: `npm run dev`
  - Build: `npm run build`
  - Migrar schema a DB: `npx prisma db push`
  - Crear admin (lee ADMIN_* del entorno): `node prisma/seed.js`
  - Deploy prod: `vercel deploy --prod --yes --token <TOKEN>` (con `.vercel/project.json` ya enlazado)
  - Deploy preview (URL aparte, no toca prod): `vercel deploy --yes --token <TOKEN>`

> ⚠️ Pasa el token de Vercel solo de forma puntual y **revócalo** después (Account → Tokens). `.env.local` y `.vercel/` están en `.gitignore`.

---

## 9. Cómo continuar desde VS Code (Claude Code)

Entorno requerido: Node 18+ (hay v24), Git. Claude Code CLI instalado globalmente (`@anthropic-ai/claude-code`).

1. **Extensión:** en VS Code → Extensions (`Ctrl+Shift+X`) → instalar **"Claude Code"** (Anthropic).
   (o abrir la terminal integrada y escribir `claude`, que instala la extensión la primera vez).
2. **Abrir la carpeta correcta:** `C:\Users\USUARIO\Desktop\almacen-sistema` (no "Aplicacion Inventarios").
3. **Iniciar Claude:** `Ctrl+Esc` o el ícono en la barra lateral; autenticarse en el navegador la primera vez.
4. **Contexto automático:** Claude lee `CLAUDE.md` (que importa `AGENTS.md`) al abrir el proyecto.
   Para ponerse al día por completo, pídele: **"Lee HANDOFF.md y continúa desde ahí."**
5. **Comando `code` en PATH** (opcional): en VS Code `Ctrl+Shift+P` → *Shell Command: Install 'code' command in PATH*.

Comandos de verificación: `node -v`, `claude --version`, `git remote -v` (debe mostrar `origin`).

---

## 10. Historial de cambios

### Sesión 1 (2026-05-30)
- `027eaf0` — seguridad: autorización por rol server-side; elimina credenciales hardcodeadas; quita DELETE_PIN.
- `a4f9f17` — feat: pantalla de auditoría (activity_logs), solo ADMIN.
- `60e20b8` — feat: permisos por rol finos (crear/editar/eliminar).
- `73f8b50` — feat(ui): identidad Grupo Ambiente; rediseño login/shell/dashboard.
- (módulos) — feat(ui): aplicar identidad a Muebles (azul) y Transporte (cian).
- Operativo: contraseña de PostgreSQL rotada en Railway; `DATABASE_URL` actualizada en `.env.local` y Vercel.

### Sesión 2 (2026-05-30)
- `d529d05` — feat: exportar auditoría CSV, skeletons en listas, tooltips en gráficos.
- `7d25f9d` — feat: ordenamiento por columna en tablas de Muebles y Transporte.
- `0714868` — test: Vitest 56 tests + GitHub Actions CI + HANDOFF actualizado.

### Sesión 3 (2026-05-31)
- `1cd8f40` — feat: módulo logística completo (rutas, GPS, mapa, conductor, flota).
  - 5 tablas nuevas: vehiculos, transportistas, rutas, paradas, ubicaciones_gps.
  - 10 endpoints API bajo `/api/logistica/`.
  - Páginas: `/dashboard/logistica` (supervisor) + `/dashboard/logistica/mi-ruta` (conductor).
  - Mapa Leaflet + polling GPS 30s + algoritmo nearest-neighbor + confirmación de entrega.
