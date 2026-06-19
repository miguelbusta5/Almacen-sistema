# 📦 HANDOFF — Sistema de Gestión de Almacén (Grupo Ambiente)

> Documento de traspaso técnico. Última actualización: 2026-06-09 (Sprint 8).
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
│  ├─ Sidebar.tsx             # Sidebar (logo, iconos lucide, activo con acento esmeralda)
│  ├─ Header.tsx              # Header + logout (dark-only, sin toggle de tema)
│  └─ Providers.tsx           # SessionProvider de Auth.js + CommandPalette
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
- Producción (Vercel): `DATABASE_URL`, `NEXTAUTH_SECRET`, `AUTH_SECRET`, `BLOB_READ_WRITE_TOKEN`.
- Local (`.env.local`, no se commitea): `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `NEXT_PUBLIC_API_URL`.
- El **seed** (`prisma/seed.js`) lee `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` del entorno; **ya no hay credenciales hardcodeadas**.
- `DATABASE_POOL_URL` *(opcional)*: si se define, el cliente Prisma lo usa en lugar de `DATABASE_URL` y activa `max: 1` (modo PgBouncer). Para activar: en Railway → PostgreSQL → Settings → habilitar PgBouncer → copiar la URL pooled → agregar a Vercel como `DATABASE_POOL_URL`.

---

## 4. Modelo de permisos y visibilidad de módulos

### Roles disponibles (10 total — Sprint 8)

| Rol | Descripción |
|-----|-------------|
| `ADMIN` | Acceso total |
| `GERENTE` | Ve todo operativo. Sin configuración de sistema |
| `SUPERVISOR_INVENTARIO` | Inventario + análisis operacional |
| `SUPERVISOR_TRANSPORTE` | Tienda + guardados + KPIs + Centro de Control |
| `SUPERVISOR_TIENDA` | Tienda + análisis + Centro de Control |
| `INVENTARIO` | Solo módulos de inventario y conteo |
| `TRANSPORTE` | Solo guardados |
| `TIENDA` | Solo despachos de tienda |
| `OPERADOR` | Rol legado — acceso general a inventario + transporte |
| `TRANSPORTISTA` | **Solo Preoperacional** (conductor; requiere transportista operativo con vehículo) |

> ⚠️ Logística (rutas GPS) y Mi Ruta están deshabilitados en Sprint 8.

### Visibilidad de módulos por rol (`src/lib/modulePermissions.ts`)

| Módulo | INV | TRN | TIENDA | SUP_INV | SUP_TRN | SUP_TDA | GERENTE | ADMIN | TRANSPORTISTA |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Novedades Inventario | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Guardados Transporte | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Despachos Tienda | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Preoperacional | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Conteo (gestión) | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Conteo (contar) | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Centro de Control | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Usuarios | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Auditoría | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |

El sidebar filtra automáticamente según el rol. Acceso por URL directa también respeta el sidebar (sin middleware de ruta — se confía en el sidebar).

### Permisos CRUD (`src/lib/permissions.ts`)

| Acción | INV/TRN | SUP_* | GERENTE | ADMIN |
|--------|:---:|:---:|:---:|:---:|
| Crear | ✅ | ✅ | ✅ | ✅ |
| Editar | ❌ | ✅ | ✅ | ✅ |
| Eliminar | ❌ | ❌ | ❌ | ✅ |
| Gestionar usuarios | ❌ | ❌ | ❌ | ✅ |
| Ver auditoría | ❌ | ❌ | ✅ | ✅ |
| Logística (crear rutas) | ❌ | ✅ (TRN) | ✅ | ✅ |

---

## 5. Funcionalidades implementadas

### Autenticación y usuarios
- ✅ Login email + contraseña (Auth.js v5, JWT 8h), emails insensibles a mayúsculas.
- ✅ 10 roles con permisos finos (ver §4).
- ✅ Gestión de usuarios (solo ADMIN): crear, editar nombre/rol/estado, resetear contraseña.
- ✅ **Rol TRANSPORTISTA**: sidebar reducido (solo Preoperacional), vinculable a un `transportista` operativo. Al crear el usuario se vincula con `transportistaId`; el transportista debe estar activo, sin usuario y con vehículo asignado.
- ✅ **Vehículos y transportistas operativos** gestionados desde `/dashboard/usuarios` (solo ADMIN). APIs en `/api/users/vehiculos`, `/api/users/transportistas-operativos`, `/api/users/transportistas-disponibles`.
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
- ✅ **Tipo de guardado** (`COMUN` / `ECOMMERCE`) — campo en DB, badge visual en tabla, filtro en lista, selector en formulario de creación y edición. Registros existentes quedan como `COMUN`.
- ✅ **Acciones para OPERADOR**: botón "Enviado" (marca DESPACHADO al instante) y botón "📅 Fecha entrega" (edita la nota con la fecha comprometida) visibles para todos los roles. API dedicada: `POST /api/transporte/[clientId]/acciones`.

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

### Módulo Conteo Cíclico ⏸ EN PAUSA
- ✅ **4 tablas**: `ciclos_conteo`, `lineas_conteo`, `operarios_ciclo`, `importaciones_teorico`.
- ✅ **Importación CSV/Excel del WMS** — detecta columnas automáticamente; clasifica líneas por `WMS: PASILLO`: `Recolección` + `RETIRO` = conteo físico; `Almacenamiento` + `Etapas salientes` = auto-fill OK.
- ✅ **CRUD operarios** desde el módulo (gestión de ~44 operarios del CEDI).
- ✅ **Asignación de bloques** a operarios por rango de depósito A→Z + día (1-4).
- ✅ **Vista operario** (`/conteo/contar`): cuenta compartida, selección de nombre, lista A→Z, formulario cajas+und/emp+reguero o total directo.
- ✅ **Cálculo de diferencias**: todas las diferencias → EN_RECONTEO; diferencia=0 → OK.
- ✅ **Reconteo**: operario recuenta; diferencia_final=0→OK, ≠0→NOVEDAD.
- ✅ **Reporte Excel**: descarga con novedades primero, luego OK. Sin columna Operario.
- ✅ **Borrar ciclos** con confirmación.
- ✅ **Recalcular auto-fill** sin borrar conteos ya ingresados.
- **Color del módulo**: verde `#16a34a`.
- **Rutas**: `/dashboard/conteo` (admin) · `/dashboard/conteo/contar` (operario).

**Pendientes internos del módulo (para reanudar):**
- [ ] Editar nombre/notas de un ciclo existente.
- [ ] Pantalla de progreso por operario (cuántos contó cada uno).
- [ ] Filtro por marca/fabricante al asignar bloques.
- [ ] Notificación visual cuando todos los PLUs del día están contados.
- [ ] Tests unitarios de la lógica de conteo.

### Escalabilidad y rendimiento (sesión 5)
- ✅ **Paginación server-side** en `/api/novedades` y `/api/transporte` — soportan parámetros `page`, `pageSize` (máx 500), `q`, `estado`, `fabricante`/`tipo`. Los módulos de UI piden 500 registros por defecto en lugar de todos.
- ✅ **GPS `watchPosition`** en Mi ruta — reemplaza el `setInterval + getCurrentPosition` que fallaba silenciosamente. El dispositivo reporta posición en cada movimiento significativo. Mejor feedback: muestra coordenadas actuales, detecta permiso denegado, botón "Activar GPS".
- ✅ **Polling supervisor reducido a 15s** (antes 30s) para el mapa de posiciones en tiempo real.

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

### UX / Diseño — Dark Elegant (Obsidiana + Esmeralda)  ← 2026-06-19
- ✅ Identidad **Dark Elegant**: base obsidiana casi negra + **único acento esmeralda** (`#14DBA0`). **Solo modo oscuro** (eliminado tema claro, `ThemeToggle` y script de init). Tokens en `globals.css`.
- ✅ **Logo real** (`/logo.png`) con inversión a blanco por CSS; fuentes **Inter** (UI) + **Sora** (display) + JetBrains Mono.
- ✅ **Acento único**: los módulos no se diferencian por color (icono + tipografía). `moduleTheme.ts` resuelve todo a esmeralda y elimina `heroImage`. `ModuleHero` sin imágenes (tipográfico).
- ✅ **Estados con color propio** (`--state-*`): creado=esmeralda, recogido=cian, CEDI=verde, enviado=azul, rechazado=rojo, alerta=ámbar.
- ✅ Microinteracciones: `lift` (hover elevado), `skeleton` (shimmer), `stagger`/`fade-up`, respeto a `prefers-reduced-motion`.

### Módulo Preoperacional (Sprint 8)
- ✅ `/dashboard/preoperacional` — solo para `TRANSPORTISTA`.
- ✅ Carga checklist desde la API, muestra vehículo y nombre del conductor.
- ✅ El conductor registra resultado por ítem (CONFORME / NO_CONFORME / NO_APLICA) + observación + foto opcional.
- ✅ Resultado automático: APROBADA / APROBADA_CON_OBSERVACIONES / BLOQUEADA (ítem crítico no conforme).
- ✅ Muestra si ya registró inspección hoy e historial reciente.
- ✅ API: `GET /api/preoperacional` (carga vehículo + checklist del conductor) · `POST /api/preoperacional` (guarda inspección).

### Flujo Tienda — Sprint 8 simplificado
- ✅ El flujo Tienda simplificado usa estados: `CREADO_TIENDA → ASIGNADO_RECOGIDA → EN_RECOGIDA → RECOGIDO → EN_ENTREGA → ENTREGADO`.
- ✅ El admin puede asignar conductor+vehículo en el modal de transición `CREADO_TIENDA → ASIGNADO_RECOGIDA`.
- ✅ Conductores se listan desde `/api/users/transportistas-disponibles` (activos, con vehículo, sin usuario activo de ruta).

### Despliegue
- ✅ Producción: **https://matec-cedi.vercel.app**.
- ✅ **Deploy automático via GitHub Actions**: cada `git push origin master` que pase los checks (tsc + tests) despliega a producción. Secretos requeridos en el repo: `VERCEL_TOKEN` (tipo `vcp_`), `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

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
- [x] **Rol TRANSPORTISTA** — nuevo rol con acceso solo a Mi ruta; vinculable a transportista en Logística; sidebar reducido.
- [x] **GPS watchPosition** — Mi ruta usa `watchPosition` nativo en lugar de polling; mejor feedback de permisos.
- [x] **Paginación server-side** en Muebles y Transporte — APIs con `page/pageSize/q/estado/tipo`.
- [⏸] **Módulo Conteo Cíclico** — en PAUSA, en producción pero pendiente de completar. Ver detalle en §5 y pendientes internos abajo.
- [x] **Pooling de DB optimizado** — `pg.Pool` configurado con `max: 3`, `idleTimeoutMillis: 30s`, `connectionTimeoutMillis: 5s`, `allowExitOnIdle: true`. Soporte de `DATABASE_POOL_URL` para activar PgBouncer sin cambiar código. Ver §3 para activar Railway PgBouncer cuando se necesite.
- [ ] **Dominio propio** (.com) si se desea.
- [x] **Sprint 6 (Sesión 7) — Gestión operacional y accountability**: Mis Tareas, SLA, Notificaciones, Intelligence v3.
- [x] **Sesión 6 — Almacenaje correcto + Tienda enriquecida**: lógica de 30 días exactos, PLUs por despacho, 65 tests.
- [x] **Sesión 5 — Reestructuración CEDI**: 8 roles, módulo Inventario, inteligencia avanzada, Centro de Control, Ranking operacional.

---

## 6b. Sesión 5 — Detalle de iniciativas (02/06/2026)

### I1 — Roles y visibilidad de módulos
- 4 nuevos roles en DB: `INVENTARIO`, `TRANSPORTE`, `SUPERVISOR_INVENTARIO`, `SUPERVISOR_TRANSPORTE`
- `src/lib/modulePermissions.ts` — matriz MODULE_ACCESS + `canSeeModule()` + `getVisibleModules()`
- Sidebar filtrado dinámicamente por rol (ningún módulo no autorizado aparece)
- CommandPalette filtrada: Ctrl+K solo muestra acciones/rutas permitidas al rol activo
- Usuarios: selector de rol con optgroups (Área Inventario / Área Transporte / Gerencia)

### I2 — Novedades Inventario (renombrado de Muebles)
- Nuevo nombre oficial: **NOVEDADES INVENTARIO** — cubre cualquier SKU del CEDI
- Nueva ruta: `/dashboard/inventario` (re-exporta la implementación existente)
- `src/lib/inventario.ts` — alias de `muebles.ts` para imports semánticos
- Todos los textos UI actualizados: "Muebles" → "Inventario"
- La ruta `/dashboard/muebles` sigue funcionando (sin romper bookmarks)

### I3 — Inteligencia operacional avanzada
- **PLU reincidente**: 3+ novedades del mismo PLU en 30 días → `critical`
- **Zona crítica**: zona con >35% de novedades activas → `warning`
- **Responsable saturado**: >10 novedades asignadas → `warning`
- Reglas anteriores: sin clasificar, sin asignar, sin contacto (guardados), entregas fallidas

### I4 — Centro de Control Operacional (`/dashboard/centro-control`)
- Vista exclusiva GERENTE, ADMIN, SUPERVISOR_* 
- Consolida: Inventario (novedades, impacto, accuracy), Guardados (costo, proyección, críticos), Conductores (tasa, incidencias, en alerta)
- Top 5 alertas críticas + top 5 warnings de inteligencia
- Ranking inventario (responsables) + Ranking conductores en la misma vista

### I5 — Ranking Operacional
- **Inventario**: tabla de responsables con novedades resueltas / abiertas / tasa %
- **Conductores**: tabla con tasa de entrega, tiempo prom/parada, incidencias (ya existente desde sesión anterior)
- Ambos visibles en el Centro de Control

### APIs nuevas (sesión 5)
- Ninguna nueva — todo consume APIs ya existentes

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
  - Build: `npm run build` · Type-check: `npx tsc --noEmit` · Tests: `npm test`
  - Migrar schema a DB: `npx prisma db push`
  - Crear admin (lee ADMIN_* del entorno): `node prisma/seed.js`
  - **Deploy prod: `git push origin master`** → GitHub Actions (`.github/workflows/ci.yml`) hace tsc + tests + `vercel deploy --prod` automáticamente.
  - Deploy preview manual: `vercel deploy --yes --token <TOKEN>` (con `.vercel/project.json` enlazado)

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
- `5103b92` — feat: fotos de evidencia reales en entregas (Vercel Blob).
- `d960e02` — ci: deploy automático via GitHub Actions (tsc + tests + vercel deploy).

### Sesión 4 (2026-06-01)
- `cb4601d` — feat(transporte): botón "Enviado" y "Editar fecha entrega" para operadores.
- `9555954` — feat(transporte): tipo de guardado (COMUN / ECOMMERCE).
- `ecf98e2` — feat: módulo conteo cíclico completo (importar CSV, asignar, contar, reconteo, Excel).
- `51d934f` — fix(conteo): auto-fill correcto (Recolección+RETIRO=contar, Almacenamiento+Etapas=auto).
- `e04c43f` — feat(conteo): borrar ciclos + CRUD operarios. Módulo en pausa.

### Sesión 5 (2026-06-01)
- `88455d2` — feat: rol TRANSPORTISTA + GPS watchPosition + paginación server-side.
  - Nuevo rol `TRANSPORTISTA` en enum Role de DB; sidebar reducido (solo Mi ruta).
  - GPS fix: `watchPosition` nativo reemplaza polling; mejor UX de permisos en móvil.
  - Paginación server-side en `/api/novedades` y `/api/transporte` (hasta 500 registros, filtros en servidor).
  - Polling supervisor de GPS: 30s → 15s.

### Sprint 8 (2026-06-09)
- `fa0e626` — simplify: flujo Tienda y Preoperacional simplificados.
- `3be8f16` — simplify: dispatch flow de Tienda.
- `f3b0d82` — simplify: acceso a Logística (deshabilitado).
- `b5b27d` — fix: modal asignar conductor+vehículo para recogida.
- `0438354` — feat: admin puede gestionar vehículos y transportistas operativos desde Usuarios.
  - APIs nuevas: `/api/users/vehiculos` (GET/POST) · `/api/users/transportistas-operativos` (GET/POST/PATCH) · `/api/users/transportistas-disponibles` (GET).
  - Al crear usuario `TRANSPORTISTA` se valida que el transportista esté activo, sin usuario y con vehículo.
  - Sidebar: `TRANSPORTISTA` solo ve **Preoperacional** (antes "Mi Ruta" — ahora deshabilitado).
  - Roles nuevos añadidos al enum: `TIENDA`, `SUPERVISOR_TIENDA` (10 roles total).
