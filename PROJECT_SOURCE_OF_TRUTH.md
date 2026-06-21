# PROJECT SOURCE OF TRUTH — Control Logístico CEDI (Grupo Ambiente)

> **Este es el documento maestro del proyecto.** Tiene **prioridad sobre cualquier otra
> documentación**: `HANDOFF.md`, `README.md`, instrucciones antiguas, decisiones previas o
> archivos del "cerebro" que lo contradigan quedan subordinados a este archivo.
>
> **Regla de precedencia:** ante cualquier conflicto entre este documento y otro `.md`,
> **manda este documento**. Ante conflicto entre este documento y el **código** (`prisma/schema.prisma`,
> `src/lib/permissions.ts`, `src/lib/modulePermissions.ts`, `src/lib/roles.ts`, `src/lib/tienda.ts`),
> **manda el código** y este documento debe corregirse.
>
> **Última actualización:** 2026-06-20 · **Producto:** `Control Logistico CEDI` (`src/config/product.ts`, v3.1)
> · **Marca:** Grupo Ambiente · **Producción:** https://matec-cedi.vercel.app

---

## 0. Jerarquía de documentación (qué leer y en qué orden)

1. **`PROJECT_SOURCE_OF_TRUTH.md`** (este archivo) — fuente principal. Leer primero.
2. **Código fuente de verdad** (mandan sobre todo `.md`):
   - `prisma/schema.prisma` — enum `Role`, `EstadoDespacho`, modelos.
   - `src/lib/roles.ts` — `USER_ROLE_VALUES` (lista canónica de roles).
   - `src/lib/permissions.ts` — matriz CRUD `can(role, action)` + `ROLE_LABEL`.
   - `src/lib/modulePermissions.ts` — `ModuleKey`, `MODULE_ACCESS`, `canSeeModule`.
   - `src/lib/tienda.ts` — estados de despacho y sus colores.
   - `src/config/product.ts` — nombre/versión del producto.
   - `src/components/common/Sidebar.tsx` — navegación real.
3. **Detalle operativo vigente** (`docs/cerebro/`, subordinado a este SOT): `00-master-context`,
   `roles-permisos`, `reglas-negocio`, `ux-ui`, `estados-despacho`, `flujo-despachos`,
   `base-datos`, `api-endpoints`, `prompts`.
4. **Referencia histórica** (NO usar como instrucción; solo para entender el pasado):
   `docs/cerebro/{decisiones, pendientes, bugs, auditoria-ui}.md`.

### Documentos OBSOLETOS (no seguir; pendientes de archivar con autorización)

| Archivo | Por qué quedó obsoleto |
|---|---|
| `README.md` | Era boilerplate de create-next-app; reemplazado por README que apunta a este SOT. |
| `HANDOFF.md` | Describe Logística/GPS/Mi Ruta como activos, 10 roles, estados Tienda viejos (`ASIGNADO_RECOGIDA`…) y fuentes Archivo/Syne. **Todo eso ya no aplica.** Se conserva solo como historia. |
| `SPRINT8_PLAN.md/SPRINT8_PLAN.md` | Archivo vacío / directorio mal nombrado. Basura. Eliminar con autorización. |
| `docs/cerebro/modulos.md` (parcial) | Lista `conteo` e `indicadores` como módulos activos: **fueron eliminados** (EPIC D, 2026-06-19). El resto del archivo sigue siendo útil. |

> ⚠️ No borrar archivos antiguos sin autorización explícita. Quedan marcados, no eliminados.

---

## 1. Visión actual del producto

Aplicación web **interna** de Grupo Ambiente para operar el **CEDI** (centro de distribución):
inventario, facturas contado de tienda, solicitudes de transporte, guardados, preoperacional de
conductores, exportaciones e integración de pedidos. Reemplaza una solución previa en HTML estático +
Google Sheets + localStorage por una plataforma única, multiusuario, con roles y trazabilidad.

Identidad de producto: **Control Logístico CEDI** (consola operativa por rol). Una sola fuente de
verdad en base de datos; acceso desde móvil y escritorio.

## 2. Objetivo de negocio

- Centralizar y dar trazabilidad a las operaciones del CEDI (quién hizo qué y cuándo → `activity_logs`).
- Eliminar dependencia de Google Forms/Sheets para flujos críticos (solicitudes de transporte, indicadores).
- Operación rápida y confiable para personal de piso (captura mínima, lectura compacta).
- Control gerencial: KPIs, prioridades y señales operativas por rol (Centro de Control).
- Mantenibilidad a 2+ años y capacidad de **escalar a nuevos módulos sin desordenar la interfaz**.

## 3. Roles de usuario (14 — fuente: `prisma enum Role` = `src/lib/roles.ts` = `src/lib/permissions.ts`)

| Valor en DB | Etiqueta UI | Qué ve / hace |
|---|---|---|
| `ADMIN` | Administrador | Todo + Usuarios + Auditoría + gestión de flota |
| `GERENTE` | Gerente | Todo operativo + Centro de Control + Auditoría (sin config de sistema) |
| `SUPERVISOR_INVENTARIO` | Supervisor Inventario | Inventario + Centro de Control |
| `SUPERVISOR_TRANSPORTE` | Supervisor Transporte | Facturas Contado + Guardados + Integración + Preoperacional + Centro de Control |
| `SUPERVISOR_TIENDA` | Supervisor Tienda | Facturas Contado + Centro de Control |
| `SUPERVISOR_ALMACENAMIENTO` | Supervisor Almacenamiento | Exportaciones + Centro de Control |
| `INVENTARIO` | Operario Inventario | Solo Inventario |
| `TRANSPORTE` | Operario Transporte | Guardados + Integración |
| `TIENDA` | Operario Tienda | Solo Facturas Contado |
| `TRANSPORTISTA` | Transportista (Conductor) | **Solo Preoperacional** (requiere vehículo asignado) |
| `OPERACIONES_MUEBLES` | Operaciones Muebles | Solo Integración de Pedidos |
| `OPERACIONES_GOURMET` | Operaciones Gourmet | Solo Integración de Pedidos |
| `ETIQUETADO` | Etiquetado | Solo Exportaciones |
| `OPERADOR` | Operador (legado) | Inventario + Transporte. **No crear usuarios nuevos con este rol.** |

> El detalle por actor (qué puede hacer en cada flujo) vive en `docs/cerebro/reglas-negocio.md`.

## 4. Módulos actuales (11 — fuente: `src/lib/modulePermissions.ts` `ModuleKey` + `Sidebar.tsx`)

| Módulo (ModuleKey) | Ruta | Etiqueta UI | Roles con acceso |
|---|---|---|---|
| `inventario` | `/dashboard/inventario` (alias `/muebles`) | Novedades Inventario | INVENTARIO, SUPERVISOR_INVENTARIO, GERENTE, ADMIN, OPERADOR |
| `tienda` | `/dashboard/tienda` | Facturas Contado | TIENDA, SUPERVISOR_TIENDA, SUPERVISOR_TRANSPORTE, GERENTE, ADMIN |
| `transporte` | `/dashboard/transporte` | Guardados | TRANSPORTE, SUPERVISOR_TRANSPORTE, GERENTE, ADMIN, OPERADOR |
| `solicitudes-transporte` | `/dashboard/solicitudes-transporte` | Solicitudes Transporte | Todos excepto TRANSPORTISTA, ETIQUETADO, SUPERVISOR_ALMACENAMIENTO |
| `integracion` | `/dashboard/integracion` | Integración Pedidos | OPERACIONES_MUEBLES, OPERACIONES_GOURMET, ADMIN, GERENTE, SUPERVISOR_TRANSPORTE, TRANSPORTE |
| `exportaciones` | `/dashboard/exportaciones` | Exportaciones | ETIQUETADO, SUPERVISOR_ALMACENAMIENTO, GERENTE, ADMIN |
| `preoperacional` | `/dashboard/preoperacional` | Preoperacional | TRANSPORTISTA, ADMIN, GERENTE, SUPERVISOR_TRANSPORTE |
| `mis-tareas` | `/dashboard/mis-tareas` | Mis Tareas | ADMIN, GERENTE, OPERADOR, INVENTARIO, TRANSPORTE, SUP_INV, SUP_TRA, TIENDA, SUP_TIE |
| `centro-control` | `/dashboard/centro-control` | Centro de Control | GERENTE, ADMIN, SUP_INV, SUP_TRA, SUP_TIE, SUP_ALMACENAMIENTO |
| `usuarios` | `/dashboard/usuarios` | Usuarios | ADMIN |
| `auditoria` | `/dashboard/auditoria` | Auditoría | ADMIN, GERENTE |

> **Alias de nombres** (la UI y el código difieren por historia): `tienda` = "Facturas Contado";
> `muebles`/`inventario` = "Novedades Inventario". La ruta y el modelo (`DespachoTienda`) siguen
> usando `tienda`. No renombrar el código.

## 5. Módulos futuros / suspendidos

| Estado | Módulo | Nota |
|---|---|---|
| ⛔ SUSPENDIDO INDEFINIDAMENTE | Logística, Rutas, GPS, "Mi Ruta" | **No reactivar.** Los modelos Prisma de rutas/GPS fueron retirados; las APIs no existen. |
| 🗑️ ELIMINADO | Conteo, Conteo/Contar, Studio, Indicadores | Borrados en EPIC D (2026-06-19); tablas dropeadas en D10. No volver a referenciar como activos. |
| 🔮 FUTURO (sin compromiso) | Indicadores/Reportería ejecutiva, dominio propio | Re-priorizar solo con decisión explícita del negocio. |

---

## 6. Reglas de navegación

- Navegación lateral única: `src/components/common/Sidebar.tsx` (`ALL_ITEMS` + `GROUPS`), filtrada por
  `canSeeModule(role, moduleKey)`. **Ningún módulo no autorizado aparece.**
- Agrupación por áreas (orden actual de `GROUPS`):
  1. **Operación diaria:** Inicio · Mis Tareas · Preoperacional.
  2. **Flujo CEDI:** Novedades Inventario · Facturas Contado · Integración Pedidos · Exportaciones · Solicitudes Transporte · Guardados.
  3. **Control:** Centro de Control.
  4. **Administración:** Usuarios · Auditoría.
- Al crecer en módulos, **mantener este modelo de áreas**; no agregar ítems sueltos sin grupo.
- La Command Palette (`Ctrl+K`) y las acciones del home (`src/config/homeActions.ts`) deben filtrarse
  con el **mismo** `canSeeModule`. Nunca exponer rutas no visibles para el rol.

## 7. Reglas de interfaz (generales)

- **Jerarquía de lectura por pantalla:** encabezado de módulo → KPIs → filtros/tabs → tabla/lista →
  detalle (panel) → acciones. Debe leerse rápido.
- **Un solo patrón por elemento:** encabezado = `ModuleHero`; KPI = `<Stat>`; tabla = `<DataTable>`;
  detalle = `SlidePanel`+`DetailSection`; confirmaciones/formularios = `Modal`/`ConfirmModal`;
  estado = `<Badge>`. No reinventar por módulo.
- **Prohibido** un segundo `<h1>` de módulo cuando ya hay `ModuleHero` (un `<h1>` de sección menor es aceptable).
- **Sin imágenes en encabezados** (`ModuleHero` es tipográfico). No reintroducir `heroImage`.
- Datos en vivo con `useAutoRefresh` (~60 s; pausar con pestaña oculta, modal abierto o edición sin guardar).
  No usar reload completo del navegador como comportamiento por defecto.

## 8. Reglas de diseño — Dark Elegant (Obsidiana + Esmeralda)

- **Solo modo oscuro.** No reintroducir tema claro, `ThemeToggle` ni script de init de tema.
- **Acento único esmeralda** (`#14DBA0`). Los **módulos NO se diferencian por color** (se distinguen por
  icono, kicker y tipografía). `src/lib/moduleTheme.ts` resuelve todos los módulos a esmeralda.
- **Los estados SÍ tienen color propio** vía tokens `--state-*` (ver §10).
- **Tipografía:** Inter (UI, `--sans`) · Sora (display/títulos/logo, `--display`/`--logo`) · JetBrains Mono (`--mono`, datos).
- **Tokens (no hex literales).** Usar siempre variables de `src/app/globals.css`:
  - Superficies: `--canvas/--bg #0A0C0E` · `--surface #121519` · `--surface2 #171B20` · `--surface3 #1E232A`.
  - Bordes: `--border rgba(255,255,255,.08)` · `--border-strong rgba(255,255,255,.16)`.
  - Texto: `--text #ECEFF1` · `--muted2 #C2C8CE` · `--muted #8B9398` · `--faint #5C636A`.
  - Acento: `--accent #14DBA0` · `--accent-bright #5BF5C7` · `--accent-deep #0E9C76`.
  - Semánticos: `--success #2EE6A6` · `--warning #FFC53D` · `--error #FF6B6B` · `--info #34D9F0`.
- **Regla dura:** ningún color hardcodeado en componentes/páginas. Si un color falta, agregar token, no literal.
- Sistemas de clases legados **en deprecación**: `op-*`, `g-*`, `cedi-*`. No crear nada nuevo con ellos;
  migrar a `ds-*` / componentes del DS cuando se toque el módulo.

## 9. Reglas de tablas (contrato canónico)

**Toda tabla operativa debe:**

1. Usar el componente compartido **`<DataTable>`** (`src/components/ui/DataTable.tsx`). No `<table>` inline.
2. Tener una columna **ESTADO por fila**, renderizada como **`<Badge>`** con color por estado (§10).
   - El estado **nunca** se comunica solo con una leyenda al pie ni con el rail de color. La leyenda es
     **ayuda secundaria** opcional; jamás reemplaza el badge por fila.
3. Estructura conceptual estándar para tablas de flujo (ej. Facturas Contado):
   `FECHA · CENTRO COSTOS · DOC/CONSECUTIVO · CLIENTE · ESTADO · [ACCIONES]`.
   - Cliente: nombre en línea 1 + documento/teléfono en línea 2 (texto secundario).
   - Doc/consecutivo: número principal + consecutivo secundario.
4. **Layout determinista:** `table-layout: fixed` + `<colgroup>` con anchos explícitos (evita el
   corrimiento de columnas thead/tbody; ver `docs/cerebro/bugs.md`).
5. **Truncado:** textos largos con `ellipsis` + atributo `title` (tooltip nativo). Nunca romper la fila.
6. **Densidad compacta**, hover sutil, fila seleccionada discreta (no invasiva). Ordenamiento por columna.
7. Estados vacíos con `EmptyState`; carga con `SkeletonTable`/`SkeletonRow`.
8. **Acciones de fila — decisión vigente y abierta:** hoy las acciones viven en el `SlidePanel` de detalle
   (decisión 2026-06-20, por un problema de layout que corría columnas). Una columna **ACCIONES** compacta
   es una opción **abierta** que requiere decisión explícita del dueño antes de implementarse. Mientras no
   se decida, las filas son clicables y abren el panel.

### 9.1 Regla crítica para tablas con rail lateral (NO NEGOCIABLE)

> **Bug histórico (2026-06-20):** `.ds-table tbody tr::before` con `tr { position: relative }` dibujaba el
> rail de estado. En Chrome, un **pseudo-elemento sobre un `<tr>` (`display: table-row`) se materializa
> como una CELDA DE TABLA ANÓNIMA** que ocupa la primera columna y **corre todas las columnas una posición
> a la derecha** (el DOM queda 5/5/5, pero el *layout* se desplaza → "ESTADO mostraba clientes"). Afectaba a
> Facturas Contado y Guardados. Fix: rail por `box-shadow` en `td:first-child`.

- ⛔ **Prohibido** usar `tr::before` / `tr::after` (ni `tbody tr::before`, `.ds-row::before`, ni cualquier
  pseudo-elemento sobre una **fila** de tabla) para rails, badges o decoración.
- ✅ El rail de estado debe ser **paint-only sobre `td:first-child`**:
  `box-shadow: inset 3px 0 0 0 var(--row-color, transparent)` o `border-left`.
- ⛔ **Prohibido** agregar un `<td>` de rail si `thead`/`colgroup` no tienen esa columna. Si el rail/alerta
  es una **columna real**, debe existir en **`thead` + `tbody` + `colgroup`** con el mismo conteo.
- ✅ Invariante estructural: **`th.length === td.length === col.length`**. Los elementos decorativos
  (rails, alertas, colores) **no pueden crear columnas visuales**.
- ✅ Toda tabla crítica debe tener **test estructural** (`th === td === col` + orden de celdas). Una tabla
  **no** se declara validada solo con test de **contenido**: hay que validar **estructura** y **render visual**
  (el render estático no detecta pseudo-elementos; son layout del navegador). Guard global:
  `src/__tests__/cssTableGuard.test.ts` falla si reaparece `tr::before`.

## 10. Reglas de estados

- Fuente de los estados de despacho: `src/lib/tienda.ts`.
- Estados `EstadoDespacho` y su color (token `--state-*`):

  | Estado | Etiqueta | Token color |
  |---|---|---|
  | `CREADO_TIENDA` | Creado en tienda | `--state-created` (esmeralda) |
  | `RECOGIDO_TIENDA` | Recogido en tienda | `--state-picked` (cian) |
  | `ENTREGADO_CEDI` | Entregado en CEDI | `--state-cedi` (verde) |
  | `ENVIADO_CLIENTE` | Enviado al cliente | `--state-sent` (azul) |
  | `RECHAZADO` | Rechazado | `--state-rejected` (rojo) |
  | `CON_NOVEDAD` | Con novedad | `--state-alert` (ámbar) |

- Otros módulos con estado (solicitudes, exportaciones, inventario) deben mapear su estado a tokens
  semánticos/`--state-*`, **nunca a hex literales**.
- Fallback obligatorio: si un registro llega sin estado conocido, mostrar badge **"Sin estado"** (muted),
  jamás dejar la celda vacía ni poner ahí otro dato.

## 11. Reglas de alertas

- Toda alerta visual (ícono ⚠, rail, banner) debe tener **explicación**: `title`/tooltip o texto, y/o
  entrada en la leyenda. Nada de íconos sin contexto.
- Mensajería contextual: componente `Alert` del DS para banners; `<Toast>` compartido para avisos
  flotantes (no duplicar markup de toast por módulo).
- Color de alerta por severidad con tokens: `--error` (crítico/bloqueo), `--warning` (atención), `--info` (informativo).

## 12. Reglas de formularios

- Primitivas compartidas `src/components/ui/form.tsx` (`Field`/`Input`/`Select`/`Textarea`) + `Modal`/`ConfirmModal`.
- Agrupar campos en **secciones** con título; no formularios planos largos. Mobile-first en captura.
- Validación: obligatorios marcados; errores inline; mismas reglas en cliente y servidor (Zod en API).
- Acciones del formulario fijas abajo (sticky) con jerarquía clara (primaria vs secundaria).

## 13. Reglas responsive

- Breakpoints de QA: **desktop 1440 · tablet 768 · móvil 390**. Todo en modo oscuro (único tema).
- Móvil: priorizar captura, lectura compacta y acciones principales visibles. Tablas con scroll interno
  contenido (no scroll de página). Sidebar colapsa a menú hamburguesa.
- No sacrificar velocidad de captura por decoración.

## 14. Reglas de permisos (doble validación — no negociable)

1. **Servidor:** cada API route valida con `requireCan(action)` / `requireRole([...])` (`src/lib/authz.ts`).
   Las APIs devuelven 401/403 reales; la seguridad **no** depende del cliente.
2. **UI:** ocultar botones/acciones/módulos con `can(role, action)` y `canSeeModule(role, moduleKey)`.
- Matriz CRUD (`src/lib/permissions.ts`): `create` (creadores), `edit` (GERENTE/ADMIN/SUP_INV/SUP_TRA/SUP_ALM),
  `delete` (solo ADMIN), `manageUsers` (ADMIN), `viewAudit` (ADMIN; visibilidad del módulo en `modulePermissions`),
  `manageLogistica` (vacío — suspendido).
- **Nunca** confiar solo en el cliente. Un usuario con acceso directo a la API no debe poder ejecutar
  acciones no permitidas.

## 15. Reglas de arquitectura frontend

- **Separación de responsabilidades por página:** `page.tsx` **posee** datos, permisos, handlers y flujo;
  el render se delega a `_components.tsx` del módulo y/o a componentes del DS. (Patrón ya aplicado en `tienda`.)
- **Design system único** en `src/components/ui/` — fuente visual canónica:
  `DataTable`, `Stat`, `ModuleHero`, `SlidePanel`/`DetailSection`/`DetailGrid`, `Modal`/`ConfirmModal`,
  `Badge`, `Alert`, `Toast`, `NetSuiteChip`, `EmptyState`, `Skeleton*`, primitivas `form`.
- **Converger, no promover:** cuando un módulo tenga UI a medida, migrarlo al componente compartido. Si el
  componente compartido es más pobre, **enriquecer el componente del DS** (no mantener CSS a medida).
- **CSS:** tokens en `globals.css`; clases `ds-*` como estándar. `op-*`/`g-*`/`cedi-*` en deprecación.
- **Estado:** local por página (`useState` + fetch) es aceptable a esta escala. No introducir estado global
  sin necesidad real.

## 16. Reglas de escalabilidad (crecer sin desordenar)

- **Plantilla de módulo nuevo:** ruta en `(dashboard)/dashboard/<modulo>/page.tsx` + `_components.tsx`;
  `ModuleKey` en `modulePermissions.ts`; entrada en `MODULE_ACCESS`, `moduleTheme.ts`, `Sidebar` (en su área),
  `homeActions.ts` y Command Palette. Reusar `DataTable`/`Stat`/`ModuleHero`/`SlidePanel`.
- Un módulo nuevo **no** introduce un sistema de clases nuevo ni colores nuevos fuera de tokens.
- La navegación crece por **áreas**, no por ítems sueltos.
- Cada módulo respeta el contrato de tabla/estado/permiso de este SOT.

## 17. Qué NO debe modificarse sin autorización

- `src/app/api/**` (endpoints y lógica de negocio).
- `prisma/schema.prisma` (modelos, enums, migraciones → se usa `prisma db push`, **no** migrations).
- `src/lib/{authz, permissions, modulePermissions, auth, roles}.ts` y `src/middleware.ts`.
- `src/types/index.ts` y los contratos de datos de `src/lib/*` (p. ej. `tienda`, `solicitudesTransporte`, `exportaciones`).
- Reglas de negocio, estados y transiciones de despacho.
- **Nunca** credenciales, tokens ni cadenas de conexión en archivos versionados (`.env*`, `.vercel/` en `.gitignore`).
- **Nunca** reactivar Logística/Rutas/GPS/Mi Ruta.

## 18. Cómo deben hacerse futuras reconstrucciones

1. **Auditar primero** (ver §19). Nada de cambios masivos sin plan.
2. **Solo presentación** salvo autorización: no tocar backend/DB/endpoints/reglas.
3. **Corregir mapeo de datos antes que estilos.** Si una tabla muestra datos en la columna equivocada,
   se arregla el mapeo primero, el estilo después.
4. **Por fases, módulo a módulo**, con QA visual del dueño entre pasos (el preview headless no autentica
   — Auth.js `MissingSecret` —, así que la validación visual la hace el usuario en su `:3100`).
5. **Validar siempre antes de push:** `npx tsc --noEmit` → `npm test` (271) → `npm run build`.
6. **Deploy = `git push origin master`** (GitHub Actions: tsc + tests + `vercel deploy --prod`).
7. **Documentar la decisión** en `docs/cerebro/decisiones.md` y actualizar este SOT si cambia una regla.
8. **Módulo piloto del rediseño:** Facturas Contado (`tienda`) — pantalla patrón; al cerrarla deja el
   patrón canónico (`DataTable` + `Stat` + `SlidePanel`) para replicar al resto.

## 19. Cómo auditar un módulo antes de tocarlo

Para cada módulo, antes de cualquier cambio, documentar:

1. **Ruta y archivo principal** (`dashboard/<modulo>/page.tsx`) + componentes relacionados.
2. **Campos de datos** que usa cada columna/sección y de qué endpoint vienen (auditar la respuesta de la API).
3. **Mapeo actual vs esperado** (¿cada columna muestra lo que debe?). Corregir mapeo primero.
4. **Permisos** que aplica (server `requireCan` + UI `canSeeModule`) — verificar doble validación.
5. **Patrones del DS** que ya usa y cuáles faltan (tabla/KPI/encabezado/detalle/estado).
6. **Riesgo de tocarlo** (bajo/medio/alto) y qué NO se debe tocar.
7. **Recomendación** concreta (migrar a `DataTable`, tokenizar colores, separar `_components.tsx`, etc.).
8. Validar al terminar con `tsc` + tests + build y QA visual del dueño.

---

## 20. Stack técnico (referencia)

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · TailwindCSS v4 + CSS vars ·
Auth.js v5 (JWT, roles) · Prisma 7 (`@prisma/adapter-pg`) · PostgreSQL (Railway) · Vercel (CI/CD por GitHub Actions).

> Este Next.js trae cambios de ruptura: consultar `node_modules/next/dist/docs/` antes de tocar APIs/convenciones desconocidas.

### Comandos

```
npm run dev            # desarrollo (Turbopack)
npx tsc --noEmit       # type-check (obligatorio antes de push)
npm test               # vitest (271 tests)
npm run build          # build de producción
npx prisma db push     # aplicar schema a Railway (NO migrations)
node prisma/seed.js    # crear admin inicial (lee ADMIN_* del entorno)
git push origin master # deploy a producción (CI: tsc + tests + vercel)
```
