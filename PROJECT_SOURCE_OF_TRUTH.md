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
> **Última actualización:** 2026-06-23 · **Producto:** `Control Logistico CEDI` (`src/config/product.ts`, v3.1)
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
  sin necesidad real — excepción ya resuelta: **Toast** (ver §19.7) y **Command Palette**, que sí son
  estado global legítimo por ser transversales a toda la app.
- **Toast/feedback inmediato:** todo módulo nuevo o tocado debe usar `useToast()` de
  `src/contexts/ToastContext.tsx` (`toast.success/error/info/warning(message, duration?)`). **Prohibido**
  crear un nuevo `useState` local de tipo `{ msg, err }` + `setTimeout` + render manual de `<Toast>` para
  feedback de acciones — ese patrón quedó deprecado tras el cierre de la Fase B (§19.7). Única excepción
  documentada: `inventario` (toast bottom-bar móvil propio, ver §19.7) — no replicar ese patrón en módulos
  nuevos, es deuda heredada, no un ejemplo a seguir.

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
8. **Módulos patrón del rediseño (cerrados):**
   - **Facturas Contado (`tienda`)** — primer módulo patrón.
   - **Guardados / Transporte (`transporte`)** — segundo módulo patrón, cerrado 2026-06-22 tras
     confirmación visual en producción (columnas alineadas, sin desfase de rail, badges de estado
     por fila, acciones en `SlidePanel`, funcionalidad conservada).
   - **Solicitudes Transporte (`solicitudes-transporte`)** — tercer módulo patrón, cerrado 2026-06-23
     tras confirmación visual en producción de tabla (Fase 1) y panel (Fase 2). **El formulario
     (`SolicitudForm`) queda excluido de este cierre por decisión técnica explícita** — ver §19.3.
   - **Exportaciones (`exportaciones`)** — cuarto módulo patrón, cerrado 2026-06-23 tras confirmación
     visual en producción de la tabla Registros (Fase 1a) y la tabla Productividad (Fase 1b). **El
     formulario de captura y el modal de edición quedan excluidos de este cierre** (el modal ya cumplía
     el patrón desde antes; el formulario de captura es el de mayor frecuencia operativa de los 4
     módulos patrón) — ver §19.5.
   - **Integración Pedidos (`integracion`)** — quinto módulo patrón, cerrado 2026-06-23 tras confirmación
     visual en producción de la tabla principal (Fase 1 única — el panel ya cumplía el patrón desde
     antes, no requirió Fase 2). **Los 3 modales propios (Nueva integración, Completar Área 2, Confirmar
     recepción transporte) y las 2 sub-tablas de PLU dentro de esos modales quedan excluidos de este
     cierre** — ver §19.6.
   - **Preoperacional (`preoperacional`)** — sexto módulo patrón, cerrado 2026-06-24 tras confirmación
     visual en producción de la tabla de historial del gestor (Fase P1 única — el panel ya cumplía el
     patrón desde antes, no requirió Fase 2). **La vista de captura del conductor (`ConductorView`)
     queda excluida de este cierre** (formulario móvil, checklist, fotos) — ver §19.9.
   - **Usuarios (`usuarios`)** — séptimo módulo patrón, cerrado 2026-06-24 (Fase U1 tabla principal +
     Fase U2 tabla secundaria de Transportistas Operativos, ambas a `DataTable`). **`FormNuevo`,
     `ModalEditar`, Maestro PLU y toda la gestión de flota (vehículos/transportistas) quedan excluidos
     de este cierre** — ver §19.10.

   Patrón canónico que dejan validado los siete módulos (replicar tal cual al resto):
   - `ModuleHero` como único encabezado de módulo (sin `heroImage`, sin segundo `<h1>`).
   - `<DataTable>` con columnas **declarativas** (no `<table>` armada a mano por módulo).
   - Estado **siempre** como `<Badge>` por fila (nunca solo color de rail o leyenda).
   - Rail lateral de estado **paint-only** sobre `td:first-child` vía `box-shadow: inset 3px 0 0 0 var(--row-color)`
     o `border-left`. **Prohibido** `tr::before`/`tr::after` (§9.1) — blindado por el guard global
     `src/__tests__/cssTableGuard.test.ts`.
   - Test estructural por tabla crítica (`th.length === td.length === col.length` + orden de celdas),
     más test de render visual — ver `facturasTable.render.test.tsx` / `guardadosTable.render.test.tsx`
     como referencia. Modo `?debugTable=1` disponible para depurar visualmente el mapeo de columnas.
   - Acciones de fila viven en el **`SlidePanel`** de detalle (no columna ACCIONES — ver §9 punto 8).
   - Leyenda de estado/color es **ayuda secundaria** opcional; nunca sustituye el badge por fila.
   - Loading (`SkeletonTable`/`SkeletonRow`), empty (`EmptyState`) y responsive resueltos con
     componentes del design system, no a medida por módulo.

## 19.1 Auditoría — Solicitudes Transporte (pre-reconstrucción, 2026-06-22)

> Tercer módulo candidato a convertirse en patrón. **Aún no reconstruido** — esta sección documenta
> el estado actual antes de tocar código, siguiendo la guía de §19.

- **Ruta real:** `/dashboard/solicitudes-transporte` (confirmada en código, coincide con §4).
- **Archivo principal:** `src/app/(dashboard)/dashboard/solicitudes-transporte/page.tsx` (777 líneas,
  monolítico: página + formulario + detalle + tabla en un solo archivo, **sin** `_components.tsx`
  separado — a diferencia del patrón de `transporte` que ya separa `_components.tsx`).
- **Lib de dominio:** `src/lib/solicitudesTransporte.ts` (231 líneas) — permisos
  (`puedeGestionarSolicitudTransporte`, `puedeEliminarSolicitudTransporte`) y lógica de estado/semáforo.
- **Endpoints usados (no tocar):** `GET/POST /api/solicitudes-transporte`,
  `GET/PATCH/DELETE /api/solicitudes-transporte/[id]`, `POST /api/solicitudes-transporte/[id]/rechazar`,
  `POST /api/solicitudes-transporte/[id]/reenviar`, `GET /api/solicitudes-transporte/catalogos`,
  `GET /api/productos-maestro/[plu]` (autocompletar PLU en el formulario).
- **Tabla actual:** `<table className="ds-table">` **armada a mano** (no usa `<DataTable>`). Columnas:
  Solicitud · Origen · Destino · Cajas · Promesa · Estado · Semáforo · Gestión (8 columnas, sin
  `<colgroup>`, sin `table-layout: fixed`).
- **Rail de estado:** variable CSS `--row-color` puesta en el `<tr>` pero **no hay CSS visible en este
  archivo que la consuma** (no usa `tr::before`, así que no dispara el guard global, pero tampoco pinta
  nada — variable inerte; revisar si hay regla en algún `.module.css` global que la use).
- **Estados como badge:** SÍ — columna "Estado" y columna "Semáforo" ambas usan `<Badge>` con color por
  estado (`ESTADO_COLOR`, `SEMAFORO_COLOR` definidos localmente, **hex literales en el componente**, no
  tokens `--state-*` — contradice §10 "nunca a hex literales").
- **Formularios:** `SolicitudForm` (modal a media pantalla, ~280-388) con 4 secciones (Información general,
  Pedido y mercancía, Origen y destino, Programación y servicio) + sub-lista dinámica de líneas PLU
  (`emptyPlu`, autocompletar por PLU vía API). Usa `inputStyle`/`SelectField`/`Field` **propios del
  módulo**, no las primitivas compartidas `src/components/ui/form.tsx` (contradice §12).
- **Filtros existentes:** búsqueda libre (`q`) + select de estado. Sin filtro por área/ciudad/transportadora
  en la UI (sí existen en catálogos pero no se exponen como filtro).
- **Acciones existentes:** crear, editar, corregir (si `RECHAZADA`), reenviar, rechazar (rol gestor),
  gestión de transporte (transportadora/guía/fecha/estado Stella), borrar (soft delete, solo `canDelete`).
  Todas viven en el panel de detalle (`<aside>` ad-hoc, no usa el componente compartido `SlidePanel`/
  `DetailSection`/`DetailGrid` de `src/components/ui/SlidePanel` — usa su propio `DetailSection`/`DetailLine`
  locales duplicando ese componente).
- **Permisos:** UI con `puedeGestionarSolicitudTransporte(role)` / `puedeEliminarSolicitudTransporte(role)`
  (de `src/lib/solicitudesTransporte.ts`) — **no** usa la matriz central `can(role, action)` de
  `src/lib/permissions.ts` como sí hace `transporte`. Server-side no auditado en esta pasada (no se tocó
  ni se debe tocar `src/app/api/**`).
- **`.ds-table` vs DataTable:** usa la clase CSS `ds-table` pero con `<table>` manual — **no** el
  componente `<DataTable>`. Mismo riesgo histórico que tuvieron Facturas/Guardados (§9.1) si en algún
  momento se le agrega un rail por pseudo-elemento; hoy no lo tiene, pero tampoco tiene el `colgroup`/
  `table-layout: fixed` que exige el contrato de tablas (§9, punto 4).
- **Riesgo de desalineación:** **medio** — 8 columnas sin `colgroup` ni anchos explícitos; funciona hoy
  por suerte de contenido, no por contrato. Migrar a `<DataTable>` lo resuelve de raíz.
- **Rails/badges/semáforos/alertas:** SÍ tiene semáforo (badge) y banner de alerta para solicitudes
  rechazadas (bloque rojo con CTA "Corregir") — patrón de alerta consistente con §11, ya con texto
  explicativo (no solo color).
- **Problemas visuales actuales:** tabla sin `colgroup`/`fixed` (riesgo latente, no confirmado en producción
  todavía); estilos inline `style={{...}}` por celda/fila en vez de clases del DS; hex literales de color
  fuera de tokens.
- **Problemas funcionales actuales:** ninguno reportado por el dueño en esta sesión; el módulo funciona,
  el objetivo es alinearlo al patrón visual/estructural, no corregir bugs funcionales.
- **Qué debe conservarse:** las 6 acciones (crear/editar/corregir/reenviar/rechazar/gestión/borrar), el
  flujo de PLUs dinámico con autocompletado, los 4 grupos del formulario, los catálogos por API, las
  validaciones obligatorias actuales, los permisos por rol (`isGestor`/`canDelete`/dueño de la solicitud).
- **Qué debe refactorizarse (solo presentación):** tabla manual → `<DataTable>` con columnas declarativas
  + `colgroup`; panel de detalle ad-hoc → `SlidePanel`/`DetailSection`/`DetailGrid` compartidos; hex
  literales → tokens `--state-*`; separar `page.tsx` en `page.tsx` (datos/handlers) + `_components.tsx`
  (render), igual que `transporte`; opcionalmente migrar `Field`/`SelectField`/inputs a
  `src/components/ui/form.tsx`.
- **Riesgos de modificarlo:** el formulario es el más complejo de los 3 módulos patrón (4 secciones +
  líneas PLU dinámicas) — alto riesgo de regresión si se reescribe el formulario completo en la misma
  pasada que la tabla. El campo `--row-color` inerte sugiere que puede haber CSS legado relacionado al
  rail que conviene confirmar antes de tocar estilos de tabla.
- **Qué patrón de Facturas/Guardados se puede reutilizar:** `<DataTable>` con columnas declarativas,
  `SlidePanel`+`DetailSection`+`DetailGrid`, `Badge` con tokens `--state-*` para Estado y Semáforo,
  estructura `_components.tsx` separada de `page.tsx`, test estructural + render visual igual a
  `guardadosTable.render.test.tsx`, modo `?debugTable=1`.

## 19.2 Propuesta de reconstrucción — Solicitudes Transporte (no ejecutada, pendiente de autorización)

1. **Header:** `ModuleHero` (ya lo usa) — conservar kicker/título/descripción/acciones (AutoRefresh + botón
   "Nueva solicitud"); eliminar el bloque `<h1>`/encabezado duplicado de las líneas ~550-559 (segundo
   encabezado redundante, contradice §7 "prohibido un segundo `<h1>` de módulo").
2. **Filtros:** conservar búsqueda libre + select de estado; mantener en una barra simple sobre la tabla
   (sin cambios funcionales).
3. **Tabla principal:** migrar a `<DataTable>` con columnas declarativas: Solicitud (pedido+solicitante) ·
   Origen · Destino · Cajas · Promesa · Estado · Semáforo · Gestión. `colgroup` con anchos explícitos,
   `table-layout: fixed`, truncado con `ellipsis`+`title` en celdas largas (solicitante/área).
4. **Estados como badges:** mantener `Badge` para Estado y Semáforo; mover `ESTADO_COLOR`/`SEMAFORO_COLOR`
   a tokens `--state-*` (extender tokens si faltan, no hex literal).
5. **Alertas/semáforos:** conservar banner de "rechazadas por corregir" tal cual (ya cumple §11).
6. **Acciones:** mover todas al `SlidePanel` compartido (hoy ya están ahí conceptualmente, pero en un
   `<aside>` propio) — usar `SlidePanel`+`DetailSection`+`DetailGrid` de `src/components/ui/SlidePanel`
   en vez de los locales.
7. **SlidePanel/detalle:** reemplazar el `<aside>` ad-hoc por el componente compartido; conservar las 7
   secciones de detalle (general, pedido/mercancía, PLUs, origen/destino, programación, rechazo, gestión)
   y los 3 flujos condicionales (corregir/reenviar, gestión, rechazo).
8. **Empty/loading/error:** ya usa `EmptyState`/`SkeletonTable`; conservar. Error banner igual.
9. **Responsive:** validar en 1440/768/390 tras migrar a `DataTable` (hoy depende de `overflowX: auto`
   manual); el formulario modal ya es full-width con scroll, validar en móvil tras el cambio.
10. **Tests necesarios:** test estructural `th.length === td.length === col.length` + orden de celdas
    (igual a `guardadosTable.render.test.tsx`), test de render con datos mock, y confirmar que el guard
    global `cssTableGuard.test.ts` sigue en verde (no se debe introducir ningún `tr::before`).

## 19.3 Cierre — Solicitudes Transporte como tercer módulo patrón oficial (2026-06-23)

**Ejecutado y confirmado visualmente por el dueño en producción:**

- **Fase 1 (tabla):** `<table>` manual reemplazada por `<DataTable<Solicitud>>` declarativo en
  `_components.tsx` (`SolicitudesTable`), con `colgroup`+`table-layout:fixed`, 8 columnas
  (Solicitud/Origen/Destino/Cajas/Promesa/Estado/Semáforo/Gestión), `data-testid` por celda, rail
  paint-only vía `getRowColor`, modo `?debugTable=1`, test estructural
  `solicitudesTransporteTable.render.test.tsx` (`th===td===col===8`).
- **Fase 2 (panel):** `<aside>` ad-hoc reemplazado por `SolicitudDetailPanel` (`_components.tsx`),
  construido sobre `SlidePanel`+`DetailSection`+`DetailGrid` compartidos. Conserva las 7 acciones
  (crear/editar/corregir/reenviar/rechazar/gestión/borrar), las 5 secciones de detalle y los flujos
  condicionales por estado (`RECHAZADA`) y rol (`isGestor`/`canDelete`). Test
  `solicitudesTransportePanel.render.test.tsx` (12 casos).
- **Estados/colores:** `ESTADO_COLOR`/`SEMAFORO_COLOR` migrados de hex literales a `var(--state-*)`/
  tokens semánticos en `_components.tsx`.
- **Validación técnica en ambas fases:** `tsc` limpio, **311/311 tests** en verde, `build` exitoso,
  0 ocurrencias de `tr::before`/`tr::after` en código fuente.
- **Backend/DB/endpoints/permisos/reglas de negocio:** no tocados en ninguna fase.

### Excluido de este cierre (decisión técnica explícita, NO bloqueante)

**El formulario `SolicitudForm` (en `page.tsx`, ~180 líneas) queda fuera del alcance del cierre.**
Motivo: es funcionalmente estable, tiene alta complejidad (4 secciones, líneas PLU dinámicas con
autocompletado, 6 campos condicionales `Otro`/`Otros`/`cobroFlete`/`restriccionHoraria`), y migrarlo
ahora representa más riesgo de regresión que beneficio. No es parte del contrato de "módulo patrón"
del SOT (§9/§10, centrado en tabla y estados), por lo que su exclusión no impide declarar el módulo
cerrado.

### Deuda visual futura controlada — Solicitudes Transporte

Pendiente, sin fecha comprometida, a evaluar solo si hay necesidad visual u operativa explícita:

1. Migrar `SolicitudForm` del overlay `position:fixed` armado a mano al componente compartido `Modal`
   (`src/components/ui/Modal.tsx`) — mismo patrón que usa `Exportaciones` para su modal de edición.
2. Unificar `Field`/`SelectField`/`inputStyle` locales (estilos inline) a las primitivas compartidas
   `src/components/ui/form.tsx` (`Field`/`Input`/`Select`, clase `g-input`).
3. Mejorar/confirmar responsive del formulario en 390px (hoy funciona pero no se ha hecho QA visual
   dedicado tras Fase 1+2, ya que el formulario no fue tocado).
4. Validar el flujo de líneas PLU dinámico (alta/baja de líneas + autocompletado on-blur) sigue íntegro
   si se migra a las primitivas compartidas — es el punto de mayor riesgo de regresión.
5. **Mantener el payload exactamente igual** al que consumen `POST/PATCH /api/solicitudes-transporte`
   — cualquier cambio de presentación no debe alterar nombres de campo ni tipos enviados al backend.

## 19.4 Auditoría — Exportaciones (pre-reconstrucción, 2026-06-23)

> Candidato a cuarto módulo patrón. **Aún no reconstruido** — esta sección documenta el estado
> actual antes de tocar código, siguiendo la guía de §19.

- **Ruta real:** `/dashboard/exportaciones` (confirmada en código y en `EXPORTACIONES_PATH` de
  `src/lib/exportaciones.ts`, coincide con §4).
- **Archivo principal:** `src/app/(dashboard)/dashboard/exportaciones/page.tsx` (612 líneas,
  monolítico: página + captura + filtros + tabla de registros + tabla de productividad + modal de
  edición, todo en un solo archivo, **sin** `_components.tsx` separado).
- **Lib de dominio:** `src/lib/exportaciones.ts` (55 líneas) — permisos (`puedeUsarExportaciones`,
  `puedeGestionarExportaciones`), helpers de fecha/duración (`todayBogota`, `calcularDuracionMinutos`),
  validación de captura (`validarCapturaExportacion`).
- **Componentes usados:** `ModuleHero`, `EmptyState`, `SkeletonTable` (de `@/components/ui`),
  **`Modal`** (de `@/components/ui/Modal` — **ya usa el componente compartido**, a diferencia de
  Solicitudes Transporte), `AutoRefreshIndicator`. `Field` es una función **local** al archivo (no
  importa las primitivas de `src/components/ui/form.tsx`), igual patrón de duplicación que tenían
  Facturas/Guardados/Solicitudes antes de su migración.
- **CSS asociado:** clases del DS vía `className` (`op-panel`, `op-table-wrap`, `op-record-card`,
  `ds-input`, `ds-btn*`) — **no CSS module propio**; usa estilos inline `style={{...}}` para tablas y
  layout, igual que los otros módulos antes de su migración a `DataTable`.
- **Tablas:** **dos** `<table>` manuales (no `<DataTable>`):
  1. Tabla "Registros" (desktop) — 10 columnas: Fecha, Usuario, Caja, PLU, Descripción, Empaque,
     Inicio, Fin, Dur., Acciones. Sin `colgroup`, sin `table-layout:fixed`. En móvil se reemplaza por
     tarjetas (`op-record-card`), no por la misma tabla con scroll.
  2. Tabla "Productividad por operario" (solo visible si `canManage`) — 7 columnas con fila de
     totales calculada inline. Tampoco usa `DataTable`.
- **Formularios:** SÍ, dos — formulario de captura (`captureCard`, inline en la página, no modal:
  numeroCaja/PLU/descripción autocompletada/unidadEmpaque) y formulario de edición (dentro del
  `Modal` compartido: mismos campos + hora inicio/fin + motivo corrección si `canManage`).
- **Panel de detalle:** **no tiene** — no hay `SlidePanel` ni vista de detalle; la única interacción
  por registro es editar (abre `Modal`) o borrar (`window.confirm` + fetch directo).
- **Modales:** SÍ — `Modal` compartido para edición. Es el único de los 4 módulos que ya usa el
  modal canónico del DS para un formulario.
- **Estados:** dos estados de negocio por registro: "En curso" (`!horaFinalizacion`) / "Finalizado"
  (`horaFinalizacion` presente). Se muestran como texto con color condicional (`item.horaFinalizacion
  ? "var(--muted2)" : COLOR`), **no como `<Badge>`** — contradice §9 punto 2 ("el estado nunca se
  comunica solo con texto/color, debe ser `<Badge>` por fila").
- **Badges:** **no usa `<Badge>` en ningún lado** del módulo (ni para estado ni para productividad).
- **Acciones:** capturar (crear), finalizar rotulación (si hay registro abierto), editar (autor o
  `canManage`), borrar (solo `canManage`, soft-delete con motivo). Paginación propia (40/página,
  anterior/siguiente). Filtros: búsqueda libre, fecha, estado (select), operario (solo `canManage`).
  Controles de productividad: rango de fechas + presets (Hoy/7 días/30 días) + filtro por operario.
- **Permisos:** `puedeUsarExportaciones(role)` (acceso al módulo) y `puedeGestionarExportaciones(role)`
  (ver costos/productividad, filtrar por operario, editar horas, borrar) — patrón propio del módulo
  (no usa `can(role, action)` de `permissions.ts`, igual que Solicitudes Transporte antes de su cierre).
- **Endpoints usados (no tocar):** `GET/POST /api/exportaciones`, `GET /api/exportaciones/stats`,
  `GET /api/exportaciones/operarios`, `PATCH/DELETE /api/exportaciones/[id]`,
  `POST /api/exportaciones/[id]/finalize`, `GET /api/productos-maestro/[plu]` (autocompletar PLU).
- **Problemas visuales actuales:** 2 tablas manuales sin `colgroup`/`fixed` (mismo riesgo histórico
  de corrimiento que tuvieron Facturas/Guardados/Solicitudes); estado sin badge (inconsistente con
  el resto de módulos patrón); vista móvil con tarjetas en vez de la tabla — funciona, pero es un
  patrón distinto al resto (Facturas/Guardados/Solicitudes usan `DataTable` con scroll interno en
  los 3 breakpoints).
- **Problemas funcionales actuales:** ninguno reportado; el módulo opera con captura consecutiva,
  finalización automática y paginación server-side ya funcionando.
- **Riesgos de modificarlo:** la captura consecutiva (`openItem` = registro sin `horaFinalizacion`)
  y la paginación server-side (`page`/`PAGE_SIZE`/`totalItems`) son lógica fina que debe preservarse
  exactamente; migrar a `DataTable` no debe tocar esa lógica, solo el render de la tabla. La tabla
  de productividad tiene una fila de "Total" calculada con `reduce` inline — hay que preservar el
  cálculo si se migra a columnas declarativas.
- **Qué debe conservarse:** las 2 tablas (registros + productividad), el formulario de captura
  inline (no modal, es flujo de alta frecuencia), el modal de edición (ya correcto), paginación,
  filtros, presets de fecha, soft-delete con motivo, doble validación de permisos (`canUse`/`canManage`).
- **Qué debe refactorizarse (solo presentación):** ambas tablas → `<DataTable>` con columnas
  declarativas + `colgroup`; estado "En curso"/"Finalizado" → `<Badge>` por fila; separar `page.tsx`
  en `page.tsx` (datos/handlers) + `_components.tsx` (render), igual que los 3 módulos patrón;
  evaluar si la vista móvil de tarjetas se reemplaza por `DataTable` con scroll (consistencia) o se
  conserva (es un patrón ya estable y específico de alta frecuencia de captura).
- **Qué patrón de los módulos oficiales se puede reutilizar:** `<DataTable>` declarativo (de los 3
  módulos patrón), `<Badge>` con tokens `--state-*` para "En curso"/"Finalizado", estructura
  `_components.tsx` separada, tests estructurales `th===td===col` (dos veces, una por tabla), modo
  `?debugTable=1`. El `Modal` de edición **ya cumple el patrón** — no requiere cambios.
- **¿Conviene reconstruirlo por fases?** Sí, y con una fase adicional respecto a los 3 módulos
  previos por tener **dos tablas**:
  - Fase 1a: tabla de Registros → `DataTable`.
  - Fase 1b: tabla de Productividad → `DataTable` (incluyendo la fila de Total).
  - Fase 2: no aplica panel (`SlidePanel`) porque el módulo no tiene vista de detalle — se podría
    evaluar en una fase futura si conviene agregar uno, pero no es parte del contrato mínimo de tabla.
  - El formulario de captura y el modal de edición se dejarían fuera de la migración inicial,
    igual que se decidió con Solicitudes Transporte, salvo que el dueño pida lo contrario.

## 19.5 Cierre — Exportaciones como cuarto módulo patrón oficial (2026-06-23)

**Ejecutado y confirmado visualmente por el dueño en producción:**

- **Fase 1a (tabla Registros):** `<table>` manual reemplazada por `<DataTable<Exportacion>>` declarativo
  en `_components.tsx` (`RegistrosTable`), con `colgroup`+`table-layout:fixed`, 10 columnas
  (Fecha/Usuario/Caja/PLU/Descripción/Empaque/Inicio/Fin/Dur./Acciones), `data-testid` por celda, estado
  "En curso"/"Finalizado" convertido a `<Badge>` dentro de la columna Fin (sin agregar columna nueva),
  modo `?debugTable=1`, test estructural `exportacionesRegistrosTable.render.test.tsx`
  (`th===td===col===10`).
- **Fase 1b (tabla Productividad):** `<table>` manual reemplazada por `<DataTable<ProductividadRow>>`
  (`ProductividadTable`), 7 columnas (Operario/Cajas/PLUs/Unidades/Finalizadas/Tiempo total/Prom.
  min/caja). La fila **Total** se conserva como fila normal del `DataTable` marcada `isTotal: true`,
  con el cálculo extraído a la función pura `calcularTotalProductividad()` (mismo `reduce` exacto que
  el original) y diferenciada visualmente vía `isRowSelected` (mecanismo CSS ya existente del DS, sin
  modificar `DataTable.tsx`). Test `exportacionesProductividadTable.render.test.tsx` (9 casos, incluye
  verificación del cálculo del Total).
- **Validación técnica en ambas fases:** `tsc` limpio, **331/331 tests** en verde, `build` exitoso,
  0 ocurrencias de `tr::before`/`tr::after` en código fuente; `git diff` confirma 0 cambios en
  `src/app/api/exportaciones/**`, `src/lib/exportaciones.ts` y `prisma/schema.prisma` en toda la serie.
- **Conservado exactamente igual:** lógica de `openItem`/captura consecutiva (`!horaFinalizacion`),
  paginación server-side (`page`/`PAGE_SIZE`/`totalItems`), filtros (búsqueda/fecha/estado/operario),
  presets de fecha (Hoy/7 días/30 días), vista móvil de tarjetas (`isMobile`, sin cambios), permisos
  (`puedeUsarExportaciones`/`puedeGestionarExportaciones`).

### Excluido de este cierre (decisión técnica explícita, NO bloqueante)

**El formulario de captura (`captureCard`, en `page.tsx`) y el modal de edición (`Modal` compartido)
quedan fuera del alcance de este cierre.** Motivos:
- El **modal de edición ya usaba el componente compartido `Modal`** desde antes de esta serie de
  fases — es el único de los 4 módulos patrón que ya cumplía ese punto sin necesidad de migración.
- El **formulario de captura es el de mayor frecuencia operativa** de los 4 módulos (se usa caja tras
  caja durante toda la jornada de etiquetado, con `autoFocus` y autocompletado de PLU on-blur) —
  tocarlo sin necesidad funcional es el peor lugar para introducir riesgo de regresión en velocidad
  de captura. No es parte del contrato de "módulo patrón" del SOT (§9/§10, centrado en tabla y estados).

### Deuda visual futura controlada — Exportaciones

Pendiente, sin fecha comprometida, a evaluar solo si hay necesidad visual u operativa explícita:

1. Unificar `Field` local del formulario de captura/edición a las primitivas compartidas
   `src/components/ui/form.tsx`.
2. Revisar consistencia de clases `ds-*` en el formulario de captura (hoy usa `ds-input`/`ds-btn*`
   ya correctamente, pero con estructura de grid a medida en vez de un layout compartido).
3. Evaluar si la vista móvil de tarjetas (`op-record-card`) converge a `DataTable` con scroll interno
   (consistencia con el resto de módulos) o se mantiene como patrón específico de alta frecuencia de
   captura — **no es necesario decidirlo ahora**.
4. **Mantener el comportamiento de captura consecutiva y autocompletado intactos** si en el futuro se
   toca el formulario — es el punto de mayor riesgo de regresión del módulo.

## 19.6 Cierre — Integración Pedidos como quinto módulo patrón oficial (2026-06-23)

**Ejecutado y confirmado visualmente por el dueño en producción:**

- **Fase 1 (única — sin Fase 2 de panel):** `<table>` manual de 7 columnas (Documento/Tipo/Fecha/Área
  inicio/Estado/Cajas/Acciones), sin `colgroup`, reemplazada por `<DataTable<Integracion>>` declarativo
  en `_components.tsx` (`IntegracionTable`), con `colgroup`+`table-layout:fixed`, `data-testid` por
  celda, badge de estado por fila (componente compartido `<Badge>`, ya en uso desde antes en este
  módulo), modo `?debugTable=1`, test estructural `integracionTable.render.test.tsx`
  (`th===td===col===7`).
- **Panel de detalle:** **no requirió migración** — ya usaba `SlidePanel`+`DetailSection`+`DetailGrid`+
  `Badge` desde antes de esta serie de fases, a diferencia de los 4 módulos previos. Es el primer
  módulo patrón cuyo cierre se logra en una sola fase de tabla.
- **Acciones conservadas exactamente:** "Completar" (si `canCompleteArea2(item)`), "Recibido" (si
  `canTransport && estado === "LISTA_TRANSPORTE"`), eliminar con confirmación inline de 2 pasos (solo
  `isAdmin`) — todas con `e.stopPropagation()` para no disparar el click de fila, que sigue abriendo
  el `SlidePanel`.
- **Validación técnica:** `tsc` limpio, **341/341 tests** en verde, `build` exitoso, 0 ocurrencias de
  `tr::before`/`tr::after` en código fuente; `git diff` confirma 0 cambios en `src/app/api/integracion/**`,
  permisos (`CREATOR_ROLES`/`TRANSPORT_ROLES`/`canCompleteArea2`) y reglas de negocio.
- **Conservado exactamente igual:** filtros (búsqueda/estado/área/tipo), `useAutoRefresh`, paginación
  (el módulo no pagina server-side, carga todo el set filtrado — sin cambios).

### Excluido de este cierre (decisión técnica explícita, NO bloqueante)

**Los 3 modales propios (`ModalNuevaIntegracion`, `ModalCompletarArea2`, `ModalMarcarRecibido`) y las
2 sub-tablas de PLU dentro de esos modales quedan fuera del alcance de este cierre.** Motivo: funcionan
correctamente hoy, no son parte del contrato de "módulo patrón" del SOT (§9/§10, centrado en tabla
principal y estados), y tocarlos sin necesidad operativa introduce riesgo sin beneficio claro — mismo
criterio aplicado al formulario de Solicitudes Transporte y al formulario de captura de Exportaciones.

### Deuda visual futura controlada — Integración Pedidos

Pendiente, sin fecha comprometida, a evaluar solo si hay necesidad visual u operativa explícita:

1. Migrar los 3 modales propios (`ModalNuevaIntegracion`, `ModalCompletarArea2`, `ModalMarcarRecibido`,
   construidos sobre un `ModalBase` local con `createPortal`) al componente compartido `Modal`
   (`src/components/ui/Modal.tsx`) — mismo patrón que ya usan Exportaciones/Usuarios.
2. Evaluar si las 2 sub-tablas de PLU dentro de modales (referencia de Área 1 en "Completar Área 2",
   y el listado de PLUs por área dentro del panel de detalle) conviene migrarlas a `DataTable` o
   dejarlas como tablas auxiliares simples (son de bajo riesgo y bajo beneficio por su tamaño reducido).
3. **No tocar estas partes ahora** — funcionan correctamente y no bloquean el patrón principal del
   módulo, ya cerrado.

## 19.7 Cierre — Fase B: ToastProvider global (escalabilidad visual, 2026-06-24)

**Ejecutado y confirmado visualmente por el dueño en producción.** Primera fase de la escalabilidad
visual global (post-cierre de los 5 módulos patrón) que introduce estado global legítimo a la app.

- **Sistema creado:** `ToastProvider` + `useToast()` en `src/contexts/ToastContext.tsx`, montado en
  `src/components/common/Providers.tsx` (mismo nivel que `CommandPaletteProvider`, dentro de
  `SessionProvider`) — cubre toda la app desde `src/app/layout.tsx`.
- **API oficial:**
  ```ts
  toast.success(message: string, duration?: number)
  toast.error(message: string, duration?: number)
  toast.info(message: string, duration?: number)
  toast.warning(message: string, duration?: number)
  toast.show({ message, type, duration })
  ```
- **Componente visual reutilizado:** `Toast` (`src/components/ui/index.tsx`), extendido de forma
  **retrocompatible** con `variant`/`onClose`/`stacked` — el uso histórico `<Toast message error />`
  sigue renderizando idéntico a como era antes de esta fase.
- **Estado interno:** manejado con un reducer puro y exportado (`toastReducer`), específicamente para
  poder testear apilado/auto-dismiss/cierre manual sin jsdom (el proyecto no tiene `jsdom` instalado y
  esta fase no instaló librerías nuevas).
- **Módulos migrados (5):** `tienda`, `transporte`, `preoperacional` (sus 2 componentes con toast
  independiente), `muebles`, `usuarios` — mismos mensajes y mismos puntos de disparo, solo cambió quién
  orquesta el estado/timeout (de `useState`+`setTimeout` local a `useToast()`).
- **Módulo NO migrado:** `inventario` — su toast es un bottom-bar móvil a medida
  (`position:fixed, bottom:100, left:20, right:20`) diseñado para no superponerse con la barra de
  acciones fija (`bottom:0`) del `BottomSheet` de captura. Migrarlo al stack genérico (`bottom:24`) tiene
  riesgo real de colisión visual en el flujo móvil de mayor frecuencia de uso del sistema. **No tocar
  hasta una fase dedicada de reconstrucción de Inventario** (módulo ya identificado como candidato de
  alto impacto/alto riesgo en la auditoría comparativa de módulos).
- **Regla nueva del DS** (añadida a §15): todo módulo nuevo o tocado debe usar `useToast()`; prohibido
  crear un nuevo `useState` local de toast salvo excepción documentada como la de `inventario`.
- **Tests agregados:** `src/__tests__/toastContext.test.tsx` (10 casos: render del provider, `useToast`
  anidado y fuera de provider sin romper, disparo de variantes, apilado, auto-dismiss y cierre manual
  vía el reducer puro, unicidad de ids).
- **Validación técnica:** `tsc` limpio, **351/351 tests** en verde, `build` exitoso, 0 ocurrencias de
  `tr::before`/`tr::after`. Conteo `<Toast` en `src/app`: 4 → 0. Conteo `setToast`: 6 → 1 (`inventario`).
- **No tocado:** backend, API, Prisma, permisos, formularios, tablas, reglas de negocio, `cedi.tsx`,
  `pageShell.tsx`, `form.tsx`.

## 19.8 Cierre — Fase C: Centro de Actividad (escalabilidad visual, 2026-06-24)

**Ejecutado y confirmado visualmente por el dueño en producción.** Segunda fase de la escalabilidad
visual global, posterior a la Fase B (ToastProvider).

### Fase C1 — Panel de notificaciones (solo lectura)

- La campana del Header (`src/components/common/Header.tsx`) **dejó de ser un `<Link>` directo a
  `/dashboard/mis-tareas`** y ahora es un botón que abre/cierra un Centro de Actividad
  (`src/components/common/ActivityCenterPanel.tsx`).
- Consume `GET /api/notificaciones?unread=true` (endpoint ya existente, sin cambios).
- **Reutiliza el mismo polling de 60s** que ya existía para el contador — un solo `fetch`, dos estados
  derivados (`notifCount` y `notifications`), sin polling duplicado.
- Renderiza notificaciones reales (no datos de ejemplo) usando el componente compartido `TimelineItem`
  (`src/components/ui/index.tsx`).
- Si la notificación tiene `enlace`, el item es navegable y cierra el panel al hacer clic; si no tiene,
  no rompe.
- Empty state con el componente compartido `EmptyState` cuando no hay notificaciones.
- Cierre por clic afuera, `Escape`, o al navegar a una notificación con enlace.
- Responsive: dropdown anclado en desktop, panel ancho-completo (`fixed`, sin desborde) en móvil.
- **No tocó:** Prisma, endpoints (ninguno creado), `/dashboard/mis-tareas`, Sidebar, Command Palette,
  permisos.

### Fase C2 — Marcar todas como leídas

- Botón "Marcar todas como leídas" en el footer del panel, **visible solo si hay notificaciones no
  leídas** (`totalNoLeidas > 0`).
- Usa únicamente `PUT /api/notificaciones/leer` (endpoint ya existente, sin cambios) — la llamada se
  extrajo como función pura `performMarkAllRead()` (testeable sin DOM/jsdom, mismo criterio que
  `toastReducer` de la Fase B).
- **No implementó** marcado individual por notificación, filtros, ni paginación — fuera de alcance de
  C2 por decisión explícita.
- Usa `useToast()` (`toast.success`/`toast.error`) para feedback inmediato — ni un `alert()` ni un
  toast ad-hoc nuevo.
- La lista visible y el contador de la campana **solo se limpian si el `PUT` responde éxito**; si
  falla, no se toca ningún estado (el usuario puede reintentar).
- Mantiene el `EmptyState` ya existente de C1 cuando la lista queda vacía tras marcar todas.

### Reglas nuevas (vigentes a partir de este cierre)

- **La campana representa notificaciones reales** (tabla `notificaciones`, no datos derivados de otro
  módulo). No reemplaza ni se mezcla con "Mis Tareas".
- **"Mis Tareas" sigue siendo un dataset distinto** (agregador de novedades/guardados/despachos
  pendientes, vía `/api/mis-tareas`) — **no debe mezclarse con notificaciones sin una auditoría
  dedicada futura** que decida explícitamente si conviene unificarlos.
- **Fase C3** (marcado individual, filtros, paginación, acciones adicionales) **queda aplazada** hasta
  que exista una necesidad operativa concreta — no se ejecuta "porque ya se puede".
- **Prohibido crear un sistema de notificaciones paralelo.** Cualquier notificación nueva en el futuro
  debe usar la tabla `Notificacion`/`/api/notificaciones` existente, no una variante propia por módulo.
- **Todo feedback inmediato debe seguir usando `ToastProvider`** (`useToast()`, ver §19.7) — la Fase C
  no introdujo ningún mecanismo de feedback alternativo.

### Tests y validación

- `src/__tests__/activityCenterPanel.render.test.tsx` — 23 casos (C1: título, notificación mock,
  empty state, contador, navegación con/sin enlace, sin tocar `/dashboard/mis-tareas`, guard
  `tr::before/after`; C2: botón aparece/desaparece según `totalNoLeidas`, estado de carga deshabilita
  y cambia texto, sin marcado individual, `EmptyState` tras vaciar, `performMarkAllRead` aislado con
  éxito/fallo/excepción de red, el panel no dispara `fetch` por sí mismo).
- **Validación técnica al cierre de C2:** `tsc` limpio, **371/371 tests** en verde, `build` exitoso,
  0 ocurrencias de `tr::before`/`tr::after` en código fuente real.
- **No tocado en ninguna de las dos fases:** Prisma, base de datos, endpoints (ni creados ni
  modificados), `/dashboard/mis-tareas`, Sidebar, Command Palette, permisos, `DataTable`, `TimelineItem`
  (componente, sin cambios de contrato).

## 19.9 Cierre — Preoperacional como sexto módulo patrón oficial (2026-06-24)

**Ruta:** `/dashboard/preoperacional`. **Ejecutado y confirmado visualmente por el dueño en producción.**

### Alcance cerrado (Fase P1, única fase de código — sin Fase 2 de panel)

- `<table>` manual dentro de `SupervisorView` (rol gestor: `ADMIN`/`GERENTE`/`SUPERVISOR_TRANSPORTE`)
  reemplazada por `<DataTable<HistorialRow>>` declarativo en `_components.tsx`
  (`HistorialPreoperacionalTable`), con `colgroup`+`table-layout:fixed`.
- **Columnas fijas (6):** Fecha, Conductor, Vehículo, Km, Estado, Ítems.
- **Columna condicional (1):** Acciones — **solo si `role === "ADMIN"`** (7 columnas para ADMIN, 6 para
  el resto de roles con acceso a la vista). Eliminar conserva la confirmación inline de 2 pasos con
  `e.stopPropagation()` para no disparar el click de fila.
- Estado como `<Badge>` por fila (Aprobada/Con observaciones/Bloqueada), igual que antes.
- Modo `?debugTable=1`, `data-testid` por celda.
- Tests estructurales en `preoperacionalTable.render.test.tsx` (17 casos): `th===td===col` validado
  por separado para rol ADMIN (7) y no-ADMIN (6).
- **Validación técnica:** `tsc` limpio, **388/388 tests** en verde, `build` exitoso, 0 ocurrencias de
  `tr::before`/`tr::after`.

### Confirmado intacto (verificado por `git diff` antes del cierre)

`ConductorView` completa (formulario móvil, checklist, captura de fotos, historial en tarjetas del
propio conductor), `uploadFoto()`, `submit()`, `estadoEstimado()`, `useIsMobile()`, todos los endpoints
`/api/preoperacional/**` y `/api/uploads/foto`, roles (`requireRole`/`requireCan` server-side,
`SUPERVISOR_ROLES.includes(role)` cliente), el `SlidePanel`+`DetailSection`+`DetailGrid` del panel de
detalle del gestor (ya conforme desde antes de esta fase, sin cambios), filtros, exportación a Excel,
paginación server-side.

### Excluido de este cierre (decisión técnica explícita, NO bloqueante)

**La vista de captura del conductor (`ConductorView`) queda completamente fuera del alcance del cierre.**
Motivo: es el único punto de registro obligatorio antes de operar un vehículo — el de mayor sensibilidad
operativa de todo el sistema (bloquear o degradar este flujo impacta directamente la operación de
transporte). No tiene tabla que migrar (es un formulario + checklist + tarjetas, ya mobile-first); no
forma parte del contrato de "módulo patrón" del SOT (§9/§10, centrado en tabla y estados).

### Deuda visual futura controlada — Preoperacional

Pendiente, sin fecha comprometida, a evaluar solo si hay necesidad operativa explícita:

1. **No tocar `ConductorView` salvo necesidad operativa concreta** — cualquier cambio futuro a la
   captura móvil del conductor requiere una auditoría dedicada y exclusiva (no combinada con otro
   módulo), dado el riesgo de bloquear la operación de transporte.
2. Cualquier mejora futura de fotos/checklist/cámara debe tener su propia auditoría — no se hereda
   automáticamente del criterio usado para la tabla del gestor.
3. El formulario de captura no usa las primitivas compartidas `src/components/ui/form.tsx` — mismo
   patrón de deuda visual ya documentado para otros módulos, sin urgencia.

## 19.10 Cierre — Usuarios como séptimo módulo patrón oficial (2026-06-24)

**Ruta:** `/dashboard/usuarios`. Migración en dos fases (U1 + U2), ambas solo de presentación de tabla.

### Alcance cerrado

- **Fase U1** — tabla principal de usuarios (`UsuariosTable` en `_components.tsx`) migrada de `<table>`
  manual a `<DataTable<User>>` declarativo, con `colgroup`+`table-layout:fixed`.
- **Fase U2** — tabla secundaria de Transportistas Operativos migrada a
  `<DataTable<TransportistaOperativo>>`, mismo patrón.
- Rol y Estado de usuario usando `<Badge>` real (no `<span>` con color manual).
- Estado de transportista (Activo/Inactivo) usando `<Badge variant="success"|"muted">`.
- Modo `?debugTable=1` soportado en ambas tablas.
- Tests estructurales para ambas tablas (`th === td === col`, sin `tr::before`/`tr::after`) —
  ver `src/__tests__/usuariosTable.render.test.tsx`.

### Confirmado intacto (verificado por `git diff` antes del cierre)

`FormNuevo`, `ModalEditar` (crear/editar usuario), gestión de Maestro PLU e importación
(`/api/productos-maestro/importar`), creación de vehículo, creación de transportista operativo, select
de asignación de vehículo y su handler, todos los endpoints `/api/users/**`, Prisma, los checks
server-side de rol `ADMIN` (`requireRole`/`requireCan`) y la lógica anti-autodegradación (un ADMIN no
puede quitarse su propio rol ADMIN ni desactivarse a sí mismo).

### Excluido de este cierre (decisión técnica explícita, NO bloqueante)

`FormNuevo`, `ModalEditar`, el flujo de Maestro PLU/importación y la gestión de flota (creación de
vehículos y transportistas operativos) quedan fuera del alcance: son formularios/modales de captura,
no tablas, y no forman parte del contrato de "módulo patrón" del SOT (§9/§10, centrado en tabla y
estados). Usuarios **no requiere fases adicionales de código** para el patrón actual.

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
