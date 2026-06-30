# Decisiones de Arquitectura y Producto

## 2026-06-30 - Cargue Gourmet: ambas áreas operan el cargue del camión

**Decisión:**
- El **ciclo de cargue** de un pedido Gourmet (Iniciar cargue, Escanear cajas, Finalizar cargue) y
  el **Cierre manual** de contingencia dejan de ser exclusivos de Transporte: ahora también los
  ejecuta **`OPERACIONES_GOURMET`**. Esto revierte la nota previa "cierre manual deliberadamente sin
  Gourmet" (decisión G3A).
- **"Enviar a Transporte"** (`UBICACION_ASIGNADA → ENVIADO_A_TRANSPORTE`) **no cambia**: sigue siendo
  el handoff que solo dispara Gourmet para continuar el proceso.

**Contexto:** en la operación real, tanto Gourmet como Transporte cargan físicamente el camión y
escanean las cajas; restringir el escaneo a Transporte bloqueaba a Gourmet.

**Implementación (doble validación servidor + UI):**
- `src/lib/gourmetCargueFlow.ts`: se agrega `OPERACIONES_GOURMET` a las transiciones del cargue
  (`ENVIADO_A_TRANSPORTE-EN_CARGUE`, `EN_CARGUE-{CARGUE_COMPLETO, CARGUE_COMPLETO_MANUAL, CON_NOVEDAD}`,
  `CON_NOVEDAD-{CARGUE_COMPLETO_MANUAL, EN_CARGUE}`).
- Endpoints `iniciar-cargue`, `escanear`, `finalizar`, `cierre-manual`: `OPERACIONES_GOURMET` en
  `ROLES_PERMITIDOS`. `TRANSPORTE` sigue **sin** cierre manual.
- `cargue-gourmet/page.tsx`: `OPERACIONES_GOURMET` en `ROLES_TRANSPORTE` y `ROLES_CIERRE_MANUAL`.
- UI: la sección "Acciones Transporte" pasa a llamarse **"Acciones de cargue"** (la usan ambas áreas).

**Validación:** `tsc --noEmit` + `npm test`.

## 2026-06-26 - Modo claro opt-in (revierte "solo modo oscuro")

**Decisión:**
- Por **directiva de la empresa** se **añade un modo claro**; el oscuro sigue siendo el **default**. Esto
  revierte la regla previa "solo modo oscuro / no reintroducir modo claro" (que queda actualizada en
  CLAUDE.md, [[ux-ui]] y el SOT).
- **Selección por usuario** con `ThemeToggle` (Header, icono sol/luna); **persistencia por dispositivo**
  (`localStorage`, sin tocar DB/Prisma) + **script anti-parpadeo** inline en `layout.tsx` que aplica el tema
  antes del paint. `<html data-theme="dark">` es el default SSR.
- **Implementación por tokens**: `:root` = oscuro; `html[data-theme="light"]` overridea los tokens semánticos
  (superficies, bordes, texto, sombras, estados, chart). La **marca esmeralda se conserva** en ambos
  (ligeramente profundizada en claro para contraste sobre blanco).

**Contexto / enfoque seguro (por fases, en oscuro nada cambió hasta exponer):**
- A — **tokenizar** todo color hardcodeado para que el override funcione: `globals.css` (fondos/sombras/hovers/
  ::selection/botones) y `charts.tsx` (grid/tooltip/ejes resueltos en runtime con `getComputedStyle` +
  re-render por `data-theme`). Auditoría: el resto de literales inline son **theme-independent** (texto sobre
  botones esmeralda/de color, fotos, toasts) → no requirieron cambio.
- B — paleta clara `html[data-theme="light"]` (oculta).
- C — mecanismo: script anti-flash + `useTheme` + `ThemeToggle` **gateado** por `THEME_TOGGLE_ENABLED`.
- D — QA del claro (aprobado) → **flip `THEME_TOGGLE_ENABLED → true`** (expone el toggle).

**Consecuencias:**
- Regla nueva: **todo color debe salir de tokens** (`var(--…)`), nunca literales inline, para no romper temas.
- Validación por fase: `tsc` + 812 tests + `build`. Commits `623590a` (globals), `1639aba` (charts),
  `4f7f862` (paleta clara), `d0250ef` (mecanismo gateado), + flip del flag + docs.

**Archivos:** `src/app/globals.css` (tokens + bloque claro), `src/app/layout.tsx` (script anti-flash),
`src/components/ui/charts.tsx`, `src/hooks/useTheme.ts`, `src/components/common/ThemeToggle.tsx`,
`src/config/featureFlags.ts`, `src/components/common/Header.tsx`; docs CLAUDE.md, [[ux-ui]],
`PROJECT_SOURCE_OF_TRUTH.md`, este archivo.

## 2026-06-26 - Eliminada la página huérfana `muebles` + cierre de deuda de la auditoría

**Decisión:**
- Se **elimina** `src/app/(dashboard)/dashboard/muebles/page.tsx` (duplicado legacy de escritorio de
  `inventario`: mismo `@/lib/muebles`, mismos endpoints `/api/novedades`, `moduleKey="inventario"`).
  Estaba huérfana — **ningún enlace** a `/dashboard/muebles` (Sidebar/homeActions/modulePermissions/
  CommandPalette → el grupo "muebles" navega a `/dashboard/inventario`). Se conserva `@/lib/muebles`
  (lo re-exporta `lib/inventario`) y los identificadores de módulo `"muebles"` (etiquetas de dominio
  en auditoría/activity-log/insights). El acceso por URL directa pasa a 404 (esperado).
- Cierre de la **deuda de la auditoría 2026-06-26** (ver [[pendientes]]): a11y de `ModuleDetailView`
  (Escape + foco, `feba756`); `prompt()/confirm()` nativos → `Modal` del DS vía hooks promesa
  `useConfirm`/`usePrompt` + `PromptModal` (`src/components/ui/useDialogs.tsx`; transporte `2ef7bbd`,
  tienda/solicitudes/exportaciones `a58dd0a`); conservar scroll del listado al volver del detalle
  (`src/hooks/useListDetailScroll.ts`, `5c529ee`); `catch (e:any)`→`unknown` en preoperacional
  (`7d42e3c`).

**Consecuencias:**
- Menos código muerto (~934 líneas) y deuda asociada (tabla nativa, 2 `prompt()`, `any`). El dominio
  novedades/inventario sigue íntegro vía `inventario/page.tsx` + `@/lib/muebles`.
- Pendiente menor: `catch (e:any)` en ~5 endpoints, tipado `any` residual, export muerto `SlidePanel`,
  evaluar cliente fetch centralizado.

**Archivos:** borrado `src/app/(dashboard)/dashboard/muebles/page.tsx`; nuevos
`src/components/ui/useDialogs.tsx`, `src/hooks/useListDetailScroll.ts`; `docs/cerebro/{pendientes,decisiones}.md`,
`PROJECT_SOURCE_OF_TRUTH.md`.

## 2026-06-26 - Migración del detalle de módulos a `ModuleDetailView` (vista a ancho completo)

**Decisión:**
- Se crea el componente compartido **`src/components/ui/ModuleDetailView.tsx`**: marco de "vista de
  detalle a ancho completo" que **reemplaza al listado** dentro del módulo (botón "Volver al listado" +
  header con título/badge/**barra de acciones** + contenedor `g-panel`). Es scroll de página normal
  (sin `position:fixed` ni altura calculada), por lo que nunca se "ve cortado" y funciona igual en
  desktop y mobile. Exportado desde `src/components/ui/index.tsx`.
- Reemplaza el overlay **`SlidePanel`** como patrón de detalle en los **7 módulos** con detalle:
  cargue-gourmet, preoperacional, integración, solicitudes-transporte, transporte (Guardados), tienda
  (Facturas Contado) y muebles. Patrón por página: `{selected ? <ModuleDetailView>…</> : <>listado</>}`.
- Las acciones que vivían en el footer del `SlidePanel` (`primaryAction`/`secondaryActions`) se mueven
  a la **barra de acciones del header** (`actions`). Los `insights` del panel se rinden arriba del
  contenido con `IntelBanner`.
- **Mobile unificado:** se elimina el bottom-sheet; desktop y mobile usan la misma vista a ancho
  completo (decisión del usuario: "no quiero más SlidePanel").

**Contexto:**
- El overlay `SlidePanel` se sentía "cortado"/angosto en Cargue Gourmet; tras descartar varios intentos
  (master-detail, full-height global —revertido por romper módulos cerrados—), la "vista a ancho
  completo" quedó aprobada en QA (G3C-QA-FIX3, commit `5653bea`) y el usuario pidió replicarla en todos
  los módulos priorizando calidad de UI/UX. Sin tocar backend, Prisma, scripts, endpoints ni lógica de
  negocio. Despliegue **por fases, 1 módulo por commit**, con QA visual del usuario entre cada una.

**Consecuencias:**
- `SlidePanel.tsx` **no se modificó**; su export overlay `SlidePanel` queda **sin uso** (código muerto
  candidato a deprecación), pero sus helpers `DetailSection`/`DetailGrid`/`MiniHistory`/`IntelBanner`
  siguen vigentes y se usan dentro de `ModuleDetailView`.
- Tests de panel migrados: `cargueGourmetDetail.render.test.tsx` (→ `PedidoDetalleView`) y
  `solicitudesTransportePanel.render.test.tsx` (aserción `slide-panel` → `solicitud-detalle-view`).
  Las pruebas de tabla no cambiaron. Validación por fase: `tsc` + **812 tests** + `build` verdes.
- **Deuda registrada** (ver [[pendientes]] "Deuda técnica (auditoría 2026-06-26)"): `ModuleDetailView`
  no cierra con Escape ni gestiona foco; se pierde scroll/filtros/paginación al volver al listado;
  `muebles` quedó migrado pero es página huérfana (sin nav/permiso) y sin test.
- Commits: `f31abbc` (componente + gourmet), `fe691f1` (preoperacional), `043f8cb` (integración),
  `8963459` (solicitudes), `19e25de` (transporte), `f4f1198` (tienda), `1034e87` (muebles).

**Archivos:** `src/components/ui/{ModuleDetailView.tsx,index.tsx}`,
`src/app/(dashboard)/dashboard/{cargue-gourmet,preoperacional,integracion,solicitudes-transporte,transporte,tienda,muebles}/…`,
`src/app/(dashboard)/dashboard/cargue-gourmet/_components/{PedidoDetalleView,PedidoDetalleContent,PedidoDetalleTypes}.tsx`
(se eliminó `PedidoDetallePanel.tsx`), `src/__tests__/{cargueGourmetDetail,solicitudesTransportePanel}.render.test.tsx`,
`docs/cerebro/{decisiones,ux-ui,pendientes}.md`, `PROJECT_SOURCE_OF_TRUTH.md`.

## 2026-06-20 - Guardados/Transporte: 2º módulo piloto al patrón canónico (DataTable)

**Decisión:**
- Se reconstruye `transporte` siguiendo el patrón validado en Facturas Contado: header `CediPage` →
  `ModuleHero`; tabla bespoke `<table className="ds-table">` + `Th` manual → **`<DataTable<Guardado>>`**
  con columnas declarativas (Fecha · Documento · Ubicación · Tipo · Estado · Almacenaje); `page.tsx` deja
  de gestionar sort (lo posee el DataTable).
- **Acciones de fila: solo en el SlidePanel** (decisión del usuario), igual que tienda. Se elimina la
  columna de acciones inline (el panel ya tenía Marcar enviado/Fecha/Editar/Eliminar/Revertir).
- **Urgencia: rail lateral por tier de alerta** (`getRowColor` = `ALERTA_TIER_COLOR`, solo si tier≠ok) +
  **score 0-100 dentro de la celda Fecha** (`AlertScore` con `title`). Se elimina la columna dedicada del
  círculo de score. Leyenda `TierLegend` explica los colores del rail (ayuda secundaria).
- Nuevos: `transporte/_components.tsx` (`GuardadosTable`, `EstadoBadge`, `TipoBadge`, `AlertScore`,
  `TierLegend`), `transporte/transporte.module.css`, `__tests__/guardadosTable.render.test.tsx`
  (estructura `th===td===col===6` + orden + contenido).

**Contexto:**
- 2º módulo piloto. Sin tocar backend/DB/endpoints/reglas. Se conservan KPIs, filtros, charts (gráficos),
  pendientes-de-tienda, export CSV, SlidePanel (almacenaje, NetSuite, log de contactos), modales, permisos
  y todas las APIs (`/api/transporte`, `/pendientes-tienda`, `/{clientId}/contactos`, `/{clientId}/acciones`).

**Consecuencias:**
- `CediPage`/`cedi.tsx` quedan sin este consumidor (deuda: evaluar su retiro cuando ningún módulo los use).
- Validado: `tsc` + 290 tests + `build` verdes. **QA visual del usuario pendiente** (`/dashboard/transporte`).

**Archivos:** `src/app/(dashboard)/dashboard/transporte/{page.tsx,_components.tsx,transporte.module.css}`,
`src/__tests__/guardadosTable.render.test.tsx`, `docs/cerebro/{decisiones,pendientes}.md`.

## 2026-06-20 - EPIC C / C4: Facturas Contado migra a `<DataTable>` (módulo piloto del SOT)

**Decisión:**
- Se cierra **C4**: `FacturasTable` (`tienda/_components.tsx`) deja la tabla bespoke `.ds-table` y usa el
  componente compartido **`<DataTable>`** (`src/components/ui/DataTable.tsx`) con columnas declarativas.
- Se **enriquece `<DataTable>`** (criterio EPIC C / SOT §15: enriquecer el DS, no mantener CSS a medida)
  con: `tableLayout: "fixed"` + `<colgroup>` por anchos (evita el corrimiento histórico thead/tbody),
  `density: "compact"` (clase `ds-table--compact` en `globals.css`), `truncate` por columna (ellipsis+title),
  `defaultSort`, `legend` (ayuda secundaria), `empty` con `action`, `skeletonRows` y `ariaLabel`. Base
  `.ds-table` (canónica; comparte estilos con `.g-table`). **0 consumidores previos → cambio sin riesgo.**
- `page.tsx` deja de gestionar el sort manual (`sortCol`/`sortDir`/`toggleSort` eliminados); el sort
  interactivo lo posee `<DataTable>`. `filtered` ahora solo filtra.

**Contexto:**
- Reconstrucción controlada del **módulo piloto** recomendado en la auditoría. Objetivo: dejar Facturas
  Contado como **patrón oficial** de tabla operativa replicable al resto (contrato SOT §9). Sin tocar
  backend, endpoints, permisos ni reglas de negocio. Mapeo de datos ya era correcto (Estado=badge por fila).

**Consecuencias:**
- `tienda.module.css`: eliminados `.facturasTableWrap`/`.facturasTable` y `.emptyWrap` (densidad ahora en el DS).
- Patrón replicable: `columns: Column<T>[]` + `<DataTable density="compact" tableLayout="fixed">` con
  `EstadoBadge` por fila + `StateLegend` como leyenda secundaria.
- Validado: `tsc` + 271 tests + `build` verdes. **QA visual del usuario pendiente** (pantalla insignia, va a prod).

**Archivos afectados:** `src/components/ui/DataTable.tsx`, `src/app/globals.css`,
`src/app/(dashboard)/dashboard/tienda/{_components.tsx,page.tsx,tienda.module.css}`, `docs/cerebro/{decisiones,pendientes,auditoria-ui}.md`.

## 2026-06-20 - Tienda: acciones de fila movidas al panel de detalle (tabla deja de cortarse)

**Decisión:**
- `FacturasTable` (`tienda/_components.tsx`) **elimina la columna Acciones inline**. Las acciones pasan a vivir solo en el `SlidePanel` de detalle (patrón de `solicitudes-transporte`). Las filas siguen siendo clicables → abren el panel.
- Se añadió **Eliminar** al `SlidePanel` (`page.tsx`, `secondaryActions`, condicionado a `canDelete`) — era la única acción que solo existía inline. Recogido/CEDI/Enviado/Re-enviar/Novedad/Rechazar/Enviar a guardado/Editar ya estaban en el panel. Al borrar se cierra el panel (`setPanelItem(null)`).

**Contexto:**
- La columna Acciones (Recogido + Rechazar + editar + eliminar ≈ 290px) hacía que el ancho preferido de la tabla (~1450px) superara el contenedor (cap 1400px de `.dash-main`), generando scroll horizontal y recortando Acciones. El usuario eligió «acciones solo en el detalle». Intentos previos (sticky, `overflow-x: clip`) no resolvían el corte de la tabla.

**Consecuencias:**
- Sin la columna, la tabla cabe de sobra y **no se corta**. Se bajó `.facturaTable min-width` 1040→820px (respaldo de scroll solo en pantallas muy angostas); se borraron `.actions`/`.ghostIcon` muertos.
- **Corrimiento de columnas (encabezado vs dato):** se intentó (en orden) quitar la columna vacía del ícono y migrar a `.ds-table` — **ninguno bastó**; el corrimiento (cuerpo ~1 columna a la derecha del encabezado) persistía pese a estructura correcta (5 `th` = 5 `td`). Era un desincronizado de `table-layout: auto` no atribuible a una regla CSS. **Fix definitivo (2026-06-20):** layout **determinista** — `table-layout: fixed` + `<colgroup>` con anchos explícitos (13/18/15/34/20%) en `tienda/_components.tsx`; bajo `fixed` los anchos los fija solo el `colgroup`, idénticos para `thead`/`tbody` → desincronizado imposible. + `overflow-wrap: anywhere` en Doc/Cliente. La tabla conserva las clases `.ds-table`. Seguimiento: evaluar `table-layout: fixed` como estándar del `<DataTable>` del DS.
- Doble validación intacta: `canDelete`/`canChangeOperationalState`/`canEditBasic` se siguen evaluando en `page.tsx` para el panel; sin cambios de API/permisos.
- Facilita **C4** (migrar a `<DataTable>`): el mapeo de columnas queda directo al no haber columna de acciones compleja. C4 sigue pendiente.
- Validado: `tsc` + 271 tests + `build` verdes. QA visual del usuario pendiente.

**Archivos afectados:** `src/app/(dashboard)/dashboard/tienda/{_components.tsx,page.tsx,tienda.module.css}`, `docs/cerebro/{auditoria-ui,bugs,pendientes,decisiones}.md`.

## 2026-06-20 - Fix global: el SlidePanel cerrado generaba scroll horizontal (recuadro vacío)

**Decisión (fix real):**
- Se envuelve el `SlidePanel` en un **clip-host** `position: fixed; inset: 0; overflow: hidden; transform: translateZ(0); pointer-events: none` (`SlidePanel.tsx`). El `transform` hace al host bloque contenedor de descendientes `position: fixed`, por lo que su `overflow: hidden` **sí** recorta el panel cerrado off-screen → sin scroll horizontal de página ni "recuadro vacío"; también recorta el bottom-sheet móvil.
- **Por qué no bastó el primer intento** (`overflow-x: clip` en `html`/`body`): un `position: fixed` tiene como bloque contenedor el **viewport**, no `body`/`html`, así que el overflow del root no lo recorta. Ese `clip` se **conserva** como red de seguridad para overflow de elementos no-fixed (con `clip`, no `hidden`, para no romper el sidebar `sticky`).
- El `SlidePanel` cerrado pasa además a `pointer-events: none` + `inert` (no captura foco ni clicks).

**Contexto:**
- QA visual del usuario en **producción**: el "recuadro vacío" (BUG-001) y la tabla "cortada" eran el **mismo** síntoma: la página se podía desplazar a la derecha hasta el panel cerrado vacío, recortando de paso la columna Acciones. Afecta a **todos** los módulos con `SlidePanel`. Ver [[bugs]] BUG-001 (actualización 2026-06-20).
- El diagnóstico previo de BUG-001 (caché de Turbopack) era incompleto: en prod no hay Turbopack.

**Consecuencias:**
- Arreglo transversal sin tocar cada página. Riesgo bajo: `clip` no rompe `sticky`; el scroll interno de tablas (`.tableScroll`) es independiente.
- La "tabla cortada" de tienda era el **mismo** overflow horizontal de página → la resuelve el `clip`. El ancho natural de `.facturaTable` (~1180px) cabe en el cap de 1400px de `.dash-main`.
- **Intento descartado:** se probó columna Acciones `sticky right` en `tienda.module.css` y se revirtió — `position: sticky` en celdas + `border-collapse: collapse` desincroniza columnas `thead`/`tbody` en Chrome (corrimiento de 1 columna). El responsive fino de la tabla se aborda en C4 con `<DataTable>`. Ver [[bugs]].
- Validado: `tsc` + 271 tests + `build` verdes. QA visual del usuario pendiente.

**Archivos afectados:** `src/app/globals.css`, `src/components/ui/SlidePanel.tsx`, `docs/cerebro/{bugs,decisiones,pendientes}.md`.

## 2026-06-20 - EPIC C / C2: KPIs de tienda migrados a `<Stat>` (DS enriquecido con `icon`)

**Decisión:**
- `FacturaKpiGrid` (`tienda/_components.tsx:49`) deja de usar `.kpiCard` propio y renderiza el `<Stat>` compartido (`src/components/ui/index.tsx`).
- Se **enriquece `<Stat>`** con prop opcional `icon?: ReactNode` (regla EPIC C: cuando el componente del DS es más pobre, enriquecer el DS en vez de mantener CSS a medida). Nueva clase `.ds-stat-icon` en `globals.css` (cuadro 34×34 tintado con `--stat-color`, igual al `.kpiIcon` anterior).

**Contexto:**
- `.ds-stat` ya era casi idéntico a `.kpiCard` (borde, glow `::after`, rail izquierdo por `--stat-color`, hover, label uppercase, `hint`→`trend`). Lo único que le faltaba era el icono.
- El `hint` («33% del total» / «Bandeja visible») mapea a `trend` con `trendUp` indefinido → texto muted sin flecha, sin cambio semántico.

**Consecuencias:**
- Tienda queda alineada con los KPIs del resto (home/preoperacional/transporte/muebles ya usan `<Stat>`). Cambio aditivo: los `<Stat>` sin `icon` no se ven afectados.
- Se eliminó el CSS muerto `.kpiCard/.kpiIcon/.kpiValue/.kpiLabel/.kpiHint` (+ regla responsive) de `tienda.module.css`; se conserva `.kpiGrid` como layout.
- **Cambio de render** (los KPIs adoptan la altura/tipografía estándar del DS, antes `min-height:132px` + valor `clamp(30–40px)`) → **requiere QA visual del usuario en :3100**.
- Validado: `tsc` + 271 tests + `build` verdes.

**Archivos afectados:** `src/components/ui/index.tsx`, `src/app/globals.css`, `src/app/(dashboard)/dashboard/tienda/{_components.tsx,tienda.module.css}`, `docs/cerebro/{decisiones,pendientes,auditoria-ui}.md`.

## 2026-06-20 - EPIC C / C3: `EstadoPipeline` se mantiene como composición local (no se promueve al DS)

**Decisión:**
- `EstadoPipeline` (`tienda/_components.tsx:145`; clases `.pipeline`/`.pipelineStep` en `tienda.module.css`) **se mantiene como composición local del módulo tienda**. No se promueve a `src/components/ui/`.

**Contexto:**
- C3 del handoff: «promover al DS o dejar el CSS module (ya tokenizado vía `--step-color` = `var(--state-*)`)». Bajo impacto.
- Es el **único consumidor** de este patrón (segmented control de filtro por estado con conteos). Ningún otro módulo usa una «tubería de estados»: transporte usa tarjetas/charts, solicitudes usa `.ds-table`, el resto `<Stat>`/`<table>`.
- Ya quedó tokenizado en A6: `--step-color` recibe `ESTADO_DESPACHO_COLOR[estado]` = `var(--state-*)` (`lib/tienda.ts:117`), on-palette Dark Elegant. No hay hex fuera de paleta ni inconsistencia visual que corregir.

**Consecuencias:**
- **Sin cambio de código ni de render** → no requiere QA visual ni `tsc`/test/build (solo se tocó documentación). Promover un componente de un solo consumidor sería abstracción prematura y contradice la razón de EPIC C (converger porque promover obliga a tocar todos los módulos; aquí no hay segundo consumidor que se beneficie).
- Disparador de reevaluación: si un segundo módulo necesita el mismo control filtro-por-estado, entonces sí promoverlo al DS (con ≥2 consumidores reales).
- C2 (`.kpiCard`→`<Stat>`) y C4 (`.facturaTable`→`<DataTable>`) siguen pendientes y requieren QA visual.

**Archivos afectados:** `docs/cerebro/{decisiones,pendientes}.md` (solo documentación; `tienda` intacto).

## 2026-06-19 - EPIC C: dirección de alineación de Facturas Contado (tienda) al design system

**Decisión de dirección (la que pedía el handoff registrar al inicio):**
- **Converger `tienda` → componentes compartidos del DS** (no promover las piezas de tienda al DS).
  Motivo: el resto del sistema ya usa `ModuleHero`/`<Stat>`/`<DataTable>`/`SlidePanel`; promover
  `.kpiCard`/`.facturaTable`/`pipeline` obligaría a tocar todos los módulos. Converger es más contenido.
- **Excepción:** donde el componente compartido sea más pobre que la pieza de tienda (p. ej. `<Stat>`
  no tiene icono, y `.kpiCard` sí), **enriquecer el componente del DS** en vez de mantener CSS a medida.
- **Ejecución incremental con QA visual del usuario entre subtareas.** Es la pantalla insignia y va
  directo a producción; la verificación headless no autentica (Auth.js `MissingSecret`), así que cada
  subtarea visual la valida el usuario en su :3100 antes de avanzar.

**Estado de subtareas:**
- **C1 (Hero → ModuleHero):** ✅ ya estaba (`tienda/page.tsx:216`, `moduleKey="tienda"` + acciones). Las métricas viven en el KPI grid de abajo (no se duplican en el hero).
- **C5 (Detalle → SlidePanel/DetailSection):** ✅ ya estaba.
- **C6 (limpiar `tienda.module.css`):** ✅ hecho ahora — eliminados `--factura-purple/cyan/blue/green/line` (muertos salvo `--factura-cyan`, que se reemplazó por `var(--info)` en `_components.tsx:431`) y las clases `.toast`/`.toastError` huérfanas (el toast ya usa el `<Toast>` compartido de A5). Sin cambio de render.
- **C2 (`.kpiCard` → `<Stat>`), C3 (pipeline al DS o tokens), C4 (`.facturaTable` → `<DataTable>`):** ⏳ **pendientes** — son los cambios visuales sobre la pantalla insignia; se dejan para la sesión con QA visual. `DataTable` (`src/components/ui/DataTable.tsx`) ya soporta `columns` con `render`, `getRowColor`, sort, `isRowSelected` y empty/skeleton, así que C4 es viable. Para C2, decidir entre enriquecer `<Stat>` con icono o promover `.kpiCard`.

**Consecuencias:**
- Validado C6: `tsc` + 271 tests + `build` verdes.
- `--state-*` ya cubre los colores de estado de tienda desde A6 (los `--factura-*` eran duplicados).

**Archivos afectados:** `src/app/(dashboard)/dashboard/tienda/{_components.tsx,tienda.module.css}`, `docs/cerebro/{decisiones,pendientes,auditoria-ui}.md`.

## 2026-06-19 - A5 + A1: componentes compartidos Toast/NetSuiteChip y header de muebles a ModuleHero

**Decision (A5):**
- Se crean en `src/components/ui/index.tsx` dos componentes compartidos y se eliminan sus copias inline:
  - `<Toast message error>` — aviso flotante abajo-derecha. Reemplaza el markup duplicado en `tienda`, `transporte`, `muebles` y `preoperacional` (×2). bg tokenizado (`var(--surface)` / `var(--error)`), `maxWidth` responsivo. De paso corrige el 2º toast de `preoperacional` que usaba `var(--text)` (legado del tema claro → blanco-sobre-claro en dark).
  - `<NetSuiteChip id>` — chip de id NetSuite. Reemplaza el span inline en `tienda`, `transporte`, `muebles`; migra el hex `#34D9F0`+alphas a `var(--info)` + `color-mix`.
- **Fuera de alcance (a propósito):** el toast de `inventario` (mobile-first bottom-sheet, diseño intencional) y el de `usuarios` (no listado en auditoria; comparte el bug `var(--text)` — pendiente 🟡).

**Decision (A1):**
- El encabezado legacy `g-module-header g-page-head` de `muebles` (con `--mod-color:#14DBA0` hardcodeado) se migra a `<ModuleHero moduleKey="inventario" …>` con `kicker`/`title`/`description` dinámica y los toggles de vista en `actions`.

**Contexto:** TAREA 2 del handoff (quick wins de [[auditoria-ui]] A5 y A1). Una por iteración.

**Consecuencias:**
- `CheckCircle2` sigue importado/usado en los 4 archivos (no quedan imports muertos). Validado: `tsc` + 271 tests + `build` verdes.
- Pendiente 🟡: migrar el toast de `usuarios` al compartido (arregla el mismo bug `var(--text)`).

**Archivos afectados:** `src/components/ui/index.tsx`, `src/app/(dashboard)/dashboard/{tienda,transporte,muebles,preoperacional}/page.tsx`, `docs/cerebro/{decisiones,pendientes,auditoria-ui}.md`.

## 2026-06-19 - A6: mapas de color de estado a paleta Dark Elegant (quick win auditoria)

**Decision:**
- Se remapean los mapas de color de estado que usaban hex VIEJO fuera de paleta ([[auditoria-ui]] A6 🔴).
- **Criterio por consumidor** (no uniforme, a proposito):
  - `lib/tienda.ts` `ESTADO_DESPACHO_COLOR` y `lib/transporte.ts` `ALERTA_TIER_COLOR` → **tokens `var(--state-*)`/semanticos**, porque solo fluyen a CSS/inline-styles. Se corrigio la unica concatenacion hex+alpha de cada uno (`tienda/_components.tsx` y `transporte/page.tsx`) a `color-mix(in srgb, … %, transparent)`.
  - `lib/muebles.ts` `ESTADO_COLOR` y `TIPO_NOVEDAD_COLOR` → **hex on-palette** (valor literal del token espejo, anotado con comentario), porque `ESTADO_COLOR` alimenta un donut de **Chart.js** (canvas) donde `var(--token)` no resuelve, y se concatena con alpha en inventario.
- `lib/sla.ts` ya usaba `var(--success/--warning/--error/--muted)`: **sin cambios** (la linea citada en la auditoria estaba stale).

**Contexto:**
- TAREA 2 del handoff (quick wins de auditoria, alto impacto / bajo riesgo). Una por iteracion.
- Mapeo tienda 1:1 con los tokens disenados para esos estados (created/picked/cedi/sent/rejected/alert).

**Consecuencias:**
- Pendiente 🟡 (documentado): los hex de `muebles.ts` son literales, no tokens; tokenizarlos requiere refactor del color de Chart.js (resolver `getComputedStyle` o pasar colores resueltos). Diferido.
- Tambien se corrigio el fallback gris off-palette `?? "#6b7280"` → `#8B9398` (`--muted`) en `muebles/page.tsx`.
- Validado: `tsc` + 271 tests + `build` verdes. Verificacion visual autenticada la hace el usuario (preview headless no loguea).

**Archivos afectados:** `src/lib/{tienda,transporte,muebles}.ts`, `src/app/(dashboard)/dashboard/{tienda/_components,transporte/page,muebles/page}.tsx`, `docs/cerebro/{decisiones,pendientes,auditoria-ui}.md`.

## 2026-06-19 - D10: borrado de tablas Prisma de los modulos eliminados (destructivo, confirmado)

**Decision:**
- Se cierra EPIC D borrando del `schema.prisma` los 10 modelos de los modulos ya eliminados en UI/API/tipos:
  - Conteo: `CicloConteo` (`ciclos_conteo`), `LineaConteo` (`lineas_conteo`), `OperarioCiclo` (`operarios_ciclo`), `ImportacionTeorico` (`importaciones_teorico`).
  - Indicadores: `IndicadorFuente` (`indicadores_fuentes`), `IndicadorResumenMes` (`indicador_resumen_mes`), `IndicadorTipoOrden` (`indicador_tipo_orden`), `IndicadorPLU` (`indicador_plu`).
  - Studio: `StudioDashboard` (`studio_dashboards`), `StudioFuente` (`studio_fuentes`).
- Se quitaron las 3 back-relations huerfanas en `User`: `ciclosConteo`, `indicadoresSync`, `studiosDashboards`.
- Se aplico a Railway con `npx prisma db push --accept-data-loss` (este proyecto no usa migrations).

**Contexto:**
- El usuario eligio "Backup y luego push". Antes de tocar la base se verifico con grep que ningun modelo superviviente ni el codigo en `src/` referenciara esos modelos (las unicas referencias vivas eran el schema y el cerebro; el resto eran worktrees stale en `.claude/`).
- Se previsualizo el SQL con `prisma migrate diff --from-config-datasource --to-schema`: confirmo solo 6 `DROP CONSTRAINT` + 10 `DROP TABLE`, sin tocar tablas supervivientes.

**Consecuencias:**
- **Perdida de datos (respaldada):** `indicador_plu` 12.024 filas, `indicador_resumen_mes` 120, `indicador_tipo_orden` 93, `indicadores_fuentes` 1, `studio_dashboards` 2; las 4 tablas de conteo y `studio_fuentes` estaban vacias. Backup JSON lossless (3.6 MB) en `Desktop/d10-backup/` (fuera de git). Los datos de indicadores son re-sincronizables desde Google Sheets.
- Base en sync con el schema (`migrate diff --exit-code` = 0, "No difference detected").
- Validado antes del push: `prisma validate`, `prisma generate`, `tsc`, 271 tests y `build` verdes.

**Archivos afectados:** `prisma/schema.prisma`, `docs/cerebro/{base-datos,decisiones,pendientes}.md`.

## 2026-06-19 - Eliminacion de modulos sin uso: Conteo, Contar, Studio, Indicadores (EPIC D)

**Decision:**
- Se eliminan por completo de **UI, API, tipos y tests** los modulos `conteo`, `conteo/contar`, `studio` e `indicadores` (incluye `cron/indicadores-sync`).
- Se borran: paginas `dashboard/{conteo,studio,indicadores}`, `src/components/studio/*`, API `api/{conteo,studio,indicadores}` + `api/cron/indicadores-sync`, libs `lib/{conteo,studio-formula,studio-sheets,indicadores}.ts`, `types/studio.ts`, `__tests__/indicadores.test.ts` (36+1 archivos).
- Se limpian referencias en compartidos: `modulePermissions.ts` (ModuleKey + MODULE_ACCESS), `moduleTheme.ts` (MODULE_THEME), `permissions.ts` (acciones huerfanas `manageConteo`/`manageStudio`), `Sidebar.tsx`, `homeActions.ts`, `CommandPalette.tsx`, `controlLogistico/resumen.ts` (señales conteo/indicadores), home `dashboard/page.tsx`, `login/page.tsx`, y `vercel.json` (cron de indicadores-sync vaciado).
- **`src/components/ui/cedi.tsx` se conserva** — lo sigue usando `transporte`.

**Contexto:**
- Peticion explicita del usuario: ya no se necesitan esos 4 modulos. Orden de trabajo del handoff: EPIC D tras B (fix drawer) y A (auditoria).

**Consecuencias:**
- **Tablas Prisma NO se tocaron (D10 pendiente de confirmacion explicita del usuario):** los modelos de ciclos/lineas/operarios de conteo, dashboards de studio e indicadores siguen en `schema.prisma`. Si se confirma: quitar modelos -> `npx prisma db push` + `generate`.
- Se agrego `exclude: ["**/.claude/**"]` a `vitest.config.ts`: las copias de tests dentro de worktrees del agente inflaban el conteo (de ahi el viejo "1176"); **la suite real son 271 tests**. CI (checkout limpio) nunca vio los worktrees.
- Validado: `tsc` + 271 tests + `build` verdes. Sidebar/home/command palette sin esos items.

**Archivos afectados:** ver lista arriba + `docs/cerebro/{decisiones,pendientes,auditoria-ui}.md`.

## 2026-06-19 - Reescritura total del frontend a Dark Elegant (Obsidiana + Esmeralda)

**Decision:**
- Se reescribe por completo la capa de presentacion hacia una identidad **Dark Elegant**: base obsidiana casi negra + **unico acento esmeralda** (`#14DBA0`, vivo con punto neon).
- **Solo modo oscuro.** Se elimina el tema claro, el componente `ThemeToggle` y el script de init de tema en `layout.tsx`. `:root` pasa a ser el tema oscuro; `<html data-theme="dark">` queda como salvaguarda de selectores legacy.
- **Acento unico:** se abandona el color por modulo. `src/lib/moduleTheme.ts` resuelve todos los modulos a esmeralda y **elimina `heroImage`**. Los modulos se diferencian por icono y tipografia.
- **Estados con color propio:** los estados operativos siguen diferenciados y vivos via tokens `--state-*` y variantes de `Badge`/`DataTable`.
- **Encabezados sin imagenes:** `ModuleHero` queda puramente tipografico (sin slot de asset). `public/ui/module-heroes/` deja de referenciarse.
- **Tipografia:** `Inter` (UI) + `Sora` (display) + `JetBrains Mono`, via `<link>` en `layout.tsx` (reemplaza Archivo).

**Contexto:**
- Peticion explicita del usuario: "borrar el frontend y reconstruirlo dark elegant". Se leyo el cerebro como contexto pero se descarto la identidad previa (azules/neon, claro+oscuro, color por modulo) por instruccion directa.
- Se ejecuto en olas: (1) `globals.css` + `moduleTheme.ts` + `layout.tsx` + shell + libreria UI + charts + `tienda.module.css`; (2) limpieza de colores hardcodeados (violetas/azules/fondos claros) en todas las paginas hacia tokens/esmeralda.

**Consecuencias:**
- **Backend intacto:** sin cambios en `src/app/api/*`, `src/lib/{authz,permissions,modulePermissions,auth}`, `middleware.ts`, `types`, `prisma` ni contratos de API. Validado con `tsc`, `npm run build` y 1176 tests verdes.
- Logistica, rutas, GPS y Mi Ruta siguen suspendidos.
- No reintroducir modo claro, color por modulo ni imagenes en encabezados.

**Archivos afectados:** `src/app/globals.css`, `src/app/layout.tsx`, `src/lib/moduleTheme.ts`, `src/components/ui/*`, `src/components/common/{Header,Logo}.tsx` (se elimino `ThemeToggle.tsx`), `src/app/(auth)/login/page.tsx`, `src/app/(dashboard)/dashboard/tienda/tienda.module.css`, todas las `dashboard/*/page.tsx` (limpieza de color), y `docs/cerebro/{ux-ui,00-master-context,pendientes,decisiones}.md`.

## 2026-06-19 - Redisenio modular de Facturas Contado

**Decision:**
- El redisenio visual se retoma por modulos, no como cambio global simultaneo.
- Facturas Contado (`/dashboard/tienda`) se convierte en el primer modulo patron para el sistema Colorido Neon Enterprise.
- La capa visual del modulo se encapsula en componentes locales (`_components.tsx`) y CSS module (`tienda.module.css`) para evitar otra capa agresiva en `globals.css`.
- `page.tsx` mantiene la propiedad de datos, permisos, handlers y flujo existente.

**Contexto:**
- La referencia visual aprobada para esta fase es `ig_018dff774d8ac89f016a348d415dec819187bf6a366faf02b6.png`.
- El objetivo es dejar una pantalla terminada antes de usarla como referencia para otros modulos.

**Consecuencias:**
- No hay cambios de base de datos, APIs, permisos ni rutas.
- Logistica, rutas, GPS y Mi Ruta siguen suspendidos.
- La migracion visual futura debe hacerse modulo por modulo y con QA visual por breakpoint.

**Archivos afectados:** `src/app/(dashboard)/dashboard/tienda/page.tsx`, `src/app/(dashboard)/dashboard/tienda/_components.tsx`, `src/app/(dashboard)/dashboard/tienda/tienda.module.css`, `docs/cerebro/ux-ui.md`, `docs/cerebro/pendientes.md`.

## 2026-06-18 - Correccion estructural del rediseño Neon

**Decision:**
- El rediseño Neon deja de ser una capa acumulada de CSS. `globals.css` queda consolidado en una fuente principal de tokens para claro/oscuro, modulos, estados, superficies, tablas, KPIs y drawers.
- `ModuleHero` pasa a ser el patron real de encabezado: renderiza el asset del modulo como elemento visual controlado con `next/image`, no como pseudo-elemento del contenedor.
- Pantallas que seguian con `g-module-header` en flujos visibles se migran a `ModuleHero`: Facturas Contado, Solicitudes Transporte, Usuarios y Auditoria.
- Las acciones principales del modulo viven dentro del hero cuando corresponde, para acercar la composicion a la referencia dark/neon aprobada.

**Contexto:**
- El rediseño desplegado se veia distinto a la referencia porque varias paginas seguian usando headers legacy y el asset se aplicaba como fondo decorativo, no como parte controlada del layout.
- La referencia vigente sigue siendo `ig_0988ec5b4e4ea755016a33f9e3f8d881918d437124ace42cbb.png`.

**Consecuencias:**
- No hay cambios de base de datos, APIs, permisos ni reglas de negocio.
- Logistica, rutas, GPS y Mi Ruta siguen suspendidos.
- El QA visual debe comparar desktop/tablet/mobile en claro y oscuro contra las referencias aprobadas.

**Archivos afectados:** `src/app/globals.css`, `src/components/ui/ModuleHero.tsx`, pantallas de Facturas Contado, Solicitudes Transporte, Usuarios y Auditoria.

## 2026-06-18 - Fix del rediseño Neon (coherencia claro/oscuro)

**Decisión:**
- El rediseño Neon Enterprise forzaba apariencia oscura con `!important` en `body`, cards, tablas, stats, status-band, slide-panel y detail-section **sin importar el tema**, rompiendo el modo claro y generando exceso de glow. Se corrige con criterio (no se agrega otra capa):
  - `body` y superficies de contenido vuelven a ser **coherentes por tema**; el tratamiento neón-oscuro de contenido se **acota a `html[data-theme="dark"]`**.
  - Glow controlado en KPI/hero; asset 3D del hero pasa de `cover` a `contain` (ya no se recorta).
  - `ModuleHero` permanece como banda neón oscura en ambos temas (intencional, igual a la referencia aprobada).
- Exportaciones: filtro de productividad **por operario** (cliente) sobre los datos ya cargados, combinable con el filtro por fecha existente. Sin cambios de API/BD/permisos.
- Exportaciones: KPI de productividad **acumulado por rango de días** (2026-06-18). El endpoint `GET /api/exportaciones/stats` pasa de consultar un solo día a un rango `desde`/`hasta` (compat con `fecha`); como la agregación ya sumaba todos los registros del `where`, ampliar el rango la vuelve acumulada sin tocar el cálculo. El panel tiene controles propios (Desde/Hasta + atajos Hoy/7/30 días, default últimos 7 días) **independientes** del filtro de la lista. Fechas en zona `America/Bogota`. Sin cambios de BD/permisos.

**Contexto:**
- Las referencias aprobadas viven en `.codex` (solo referencia); los assets versionados están en `public/ui/module-heroes/`.
- Queda pendiente consolidar los tres bloques `:root` apilados en una sola fuente de verdad y QA visual con capturas en 1440/768/390.

**Archivos:** `src/app/globals.css`, `src/app/(dashboard)/dashboard/exportaciones/page.tsx`, `docs/cerebro/ux-ui.md`.


## 2026-06-18 - Rediseño Colorido Neon con assets por modulo

**Decision:**
- La direccion visual vigente se corrige a **Colorido Neon Enterprise con assets**.
- Se crea `ModuleHero` como encabezado unico para modulos y se agregan renders por modulo en `public/ui/module-heroes/`.
- `src/lib/moduleTheme.ts` ahora incluye `heroImage`, `heroGradient`, `glow` y `surface` ademas de los colores base del modulo.
- Los encabezados legacy `g-module-header`, `op-module-header` y `cedi-hero` consumen las mismas variables para evitar pantallas planas mientras se completa la migracion.
- KPIs, tablas y drawers reciben profundidad neon: glow, rails de estado, hover tintado y superficies dark enterprise.

**Contexto:**
- El despliegue anterior solo impactaba claramente el menu lateral y algunos tintes; las pantallas principales seguian viendose blancas/pastel y sin imagenes en titulos.
- La referencia aprobada es `ig_0988ec5b4e4ea755016a33f9e3f8d881918d437124ace42cbb.png`, con hero dark/neon, asset 3D, KPIs vivos, tabs de estado, tabla densa y drawer coloreado.

**Consecuencias:**
- No hay cambios de base de datos, APIs, permisos ni reglas de negocio.
- Facturas Contado, Guardados, Solicitudes Transporte, Exportaciones, Preoperacional, Inventario, Integracion, Conteo, Indicadores, Usuarios y Auditoria quedan conectados al sistema de heroes/assets.
- Logistica, rutas, GPS y Mi Ruta siguen suspendidos.

**Archivos afectados:** `src/lib/moduleTheme.ts`, `src/components/ui/ModuleHero.tsx`, `src/components/ui/pageShell.tsx`, `src/app/globals.css`, `public/ui/module-heroes/*`, pantallas operativas y `docs/cerebro/ux-ui.md`.

---

## 2026-06-18 - Colorido Completo Enterprise para Control Logistico CEDI

**Decision:**
- La direccion visual vigente pasa a **Colorido Completo Enterprise** en claro y oscuro.
- Se abandona la restriccion **Claro Ejecutivo Azul/Gris**: el azul ya no limita toda la interfaz.
- `src/lib/moduleTheme.ts` vuelve a ser la fuente de verdad para color por modulo, incluyendo `color`, `tint`, `gradient`, `darkColor`, `darkTint` y contraste.
- Los estados operativos recuperan color propio independiente del modulo: creado, pendiente, rechazado, recogido, entregado, enviado, efectuado y bloqueado.
- Los componentes compartidos (`PageShell`, `DataTable`, `SlidePanel`, `Badge`, `Stat`, `CediStat`) aceptan variables/tokens para aplicar color sin crear estilos inline nuevos por pantalla.

**Contexto:**
- El usuario reporto que la version azul/gris dejo la aplicacion plana y sin la energia visual que tenian pantallas como Facturas Contado.
- Se aprobaron referencias visuales claras y oscuras con navegacion viva, KPIs coloreados, tabs de estado, rails en tabla y drawers con secciones por color.

**Consecuencias:**
- Se reorienta la Fase 3 visual hacia las pantallas pendientes: Solicitudes Transporte, Preoperacional, Integracion, Conteo/Contar, Centro de Control y Mis Tareas.
- Facturas Contado queda reforzada como pantalla patron de detalle vivo: KPIs coloreados, tabs por estado, tabla con rail y drawer con secciones coloreadas.
- No hay cambios de base de datos, APIs, permisos ni reglas de negocio.
- Logistica, rutas, GPS y Mi Ruta siguen suspendidos.

**Archivos afectados:** `src/app/globals.css`, `src/lib/moduleTheme.ts`, `src/components/ui/*`, `src/components/common/Sidebar.tsx`, pantallas Fase 3 y `docs/cerebro/*`.

---

## 2026-06-18 - Rediseño premium Vercel/Linear (Design System v6) — Fase 1

**Decision:**
- La paleta base migra a **gris neutro premium** (Vercel/Linear): lienzo `#F7F7F8`, superficies blancas, bordes `rgba(0,0,0,0.07)`, texto casi negro `#1A1A1A`. El azul deja de teñir el lienzo y pasa a ser **acento de marca**; los colores por módulo (`--mod-*`) se mantienen vivos.
- Sombras suaves de base neutra (negra) en lugar de las azuladas (`rgba(15,23,42,...)`).
- Se crean **componentes reutilizables** en `src/components/ui/`: `PageShell` (encabezado de página module-aware, `CediPage` queda como alias delgado), `Modal` + `ConfirmModal` (modal premium único), `DataTable` (tabla con sorting/empty/skeleton) y primitivas `form` (`Field`/`Input`/`Select`/`Textarea`).
- **Estrategia de modales: híbrida** — `SlidePanel` para detalle/lectura; `Modal`/`ConfirmModal` para confirmaciones y formularios crear/editar (reemplazan los modales ad-hoc por módulo, fase a fase).

**Contexto:**
- Tras el Design System v5 la base de tokens era sólida pero la adopción despareja (≈10 páginas con miles de líneas inline). El brief pide un look empresarial premium tipo Vercel/Linear sin tocar lógica de negocio ni permisos.
- Ejecución **por fases**: F1 fundación (esta), F2 páginas de alto tráfico + Studio (restyle), F3 resto + responsive.

**Consecuencias:**
- Cambios solo de presentación; sin tocar `permissions.ts`/`modulePermissions.ts` ni esquema Prisma.
- Backlog Studio documentado en `pendientes.md` (autosave debounce, preview Sheets, gráficas línea/pastel).
- Logística/rutas/GPS/Mi Ruta siguen suspendidos.

**Archivos afectados:** `src/app/globals.css`, `src/components/ui/pageShell.tsx` (nuevo), `Modal.tsx` (nuevo), `DataTable.tsx` (nuevo), `form.tsx` (nuevo), `ui/cedi.tsx`, `ui/charts.tsx`.

## 2026-06-17 - Indicadores CEDI sincronizados desde Google Sheets

**Decision:**
- Se crea el modulo propio **Indicadores CEDI** en `/dashboard/indicadores`.
- Los datos de Google Sheets se sincronizan a PostgreSQL con service account; la UI consulta datos cacheados.
- `ADMIN` y `GERENTE` pueden sincronizar manualmente; supervisores autorizados solo consultan.
- Vercel Cron ejecuta `/api/cron/indicadores-sync` diario a las 06:00 UTC en el plan actual; una frecuencia de 15 minutos queda para un plan que lo permita.
- Se inicia la consolidacion visual **CEDI Clean Platform** con componentes reutilizables en `src/components/ui/cedi.tsx`.

**Contexto:**
- La empresa usa actualmente Looker Studio sobre Google Sheets para indicadores.
- El objetivo es llevar esos indicadores dentro de la app sin exponer credenciales ni depender de consultas directas desde el navegador.
- La interfaz se percibia plana/generica; la respuesta tecnica es crear componentes limpios y reutilizables, no otra capa visual aislada.

**Consecuencias:**
- Nuevos modelos `IndicadorFuente` e `IndicadorCedi`.
- Nuevas APIs `/api/indicadores`, `/api/indicadores/sync` y `/api/cron/indicadores-sync`.
- Nuevo modulo en permisos, sidebar, command palette, home actions y resumen operativo.
- Se instala `googleapis`.
- Logistica, rutas, GPS y Mi Ruta siguen suspendidos.

**Archivos afectados:** `prisma/schema.prisma`, `src/lib/indicadores.ts`, `src/app/api/indicadores/*`, `src/app/api/cron/indicadores-sync/route.ts`, `src/app/(dashboard)/dashboard/indicadores/page.tsx`, permisos/navegacion y `docs/cerebro/*`.

## 2026-06-16 - Capa CEDI Harmony para armonia visual azul/gris

**Decision:**
- Se agrega una capa visual **CEDI Harmony** encima del rediseño azul/gris.
- La interfaz reduce al minimo los colores rojo, verde y ambar visibles; verde y ambar dejan de funcionar como colores principales de estado.
- Los estados positivos, finalizados, activos y OK usan azul; los estados pendientes/alerta usan gris; rojo queda reservado para errores, rechazos, bloqueos y acciones destructivas.
- Se agrega un fondo operativo sutil con textura de plano/grid para que la app tenga presencia visual y no se sienta plana.

**Contexto:**
- El usuario reporto que la app todavia se veia sin armonia por mezcla de rojo, verde y otros colores, y que faltaba un fondo visual satisfactorio.
- La mencion `@base44` se trato como referencia/checklist; el repo no tiene `base44/config.jsonc`, por lo que no hay proyecto Base44 que operar por CLI.

**Consecuencias:**
- `globals.css` centraliza la nueva capa Harmony.
- Constantes visuales de Inventario, Conteo, Tienda y Transporte se alinean a azul/gris.
- Se limpian colores hardcodeados en Dashboard, Usuarios, Transporte, Inventario, Conteo, Tienda, Exportaciones, Solicitudes, Centro de Control, Auditoria y ruta legacy Muebles.
- No hay cambios de APIs, schema, permisos ni flujos de negocio.
- Logistica, rutas, GPS y Mi Ruta siguen suspendidos.

---

## 2026-06-16 - Revision predeploy Lovable/Base44 del rediseno azul/gris

**Decision:**
- El deploy del rediseno queda condicionado a una revision visual previa con Lovable como referencia y Base44 como checklist comparativo cuando no haya herramienta callable.
- Lovable se usa solo para criterio visual/prototipo, sin conectar produccion ni reemplazar la app Next.js.
- La app conserva la identidad **Claro Ejecutivo Azul/Gris** y elimina rastros multicolor de pantallas operativas secundarias.

**Contexto:**
- Antes de produccion se pidio una revision adicional para elevar estetica, jerarquia, navegacion y estados en vivo.
- Base44 no expuso herramienta callable en esta sesion, por lo que se registra como revision comparativa documentada.

**Consecuencias:**
- `Integracion`, `Mis Tareas` y `Centro de Control` quedan alineados a azul/gris y datos en vivo.
- Los tokens heredados de colores por modulo se neutralizan hacia azul.
- Logistica, rutas, GPS y Mi Ruta siguen suspendidos.

**Referencia Lovable:** https://lovable.dev/projects/4d6b97cb-f3a2-4767-8980-571366817628

---

## 2026-06-16 - Rediseño Claro Ejecutivo Azul/Gris y datos en vivo

**Decision:**
- Se reemplaza la capa visual **Operativo Premium** multicolor por una identidad **Claro Ejecutivo Azul/Gris**.
- El azul CEDI queda como acento principal para navegacion, accion y foco; rojo, ambar y verde quedan solo para estados semanticos.
- Se crea una capa de datos en vivo con refresh en segundo plano para bandejas y tableros, sin recargar toda la pagina ni perder formularios.

**Contexto:**
- El cambio visual anterior no gusto porque la app seguia sintiendose generica y demasiado cargada de colores.
- El usuario pidio una reestructuracion visual real con grises, blanco, azul, mejores iconos, sombras y animaciones de botones.

**Consecuencias:**
- `moduleTheme` deja de diferenciar modulos por colores fuertes.
- `globals.css` mantiene compatibilidad con clases existentes, pero la salida visual pasa a blanco/gris/azul.
- Se agregan `useAutoRefresh` y `AutoRefreshIndicator` para actualizar datos cada 60 segundos y pausar durante captura/edicion.
- Logistica, rutas, GPS y Mi Ruta siguen suspendidos.

**Archivos afectados:** `src/app/globals.css`, `src/lib/moduleTheme.ts`, `src/components/common/*`, `src/components/control-logistico/*`, pantallas principales del dashboard, `src/hooks/useAutoRefresh.ts`, `docs/cerebro/ux-ui.md`.

---

> Links: [[pendientes]] · [[modulos]] · [[flujo-despachos]]

Registro cronológico de decisiones importantes. Una entrada por decisión, con fecha, contexto y consecuencias.

---

## 2026-06-16 - Rediseño Operativo Premium Control Logístico CEDI

**Decision:**
- La app adopta una dirección visual **Operativo Premium** para dejar de sentirse como SaaS genérico.
- Se abandona definitivamente "Torre CEDI" como lenguaje vigente; la identidad activa es **Control Logístico CEDI**.
- Se crea una capa visual v2 con workbench, paneles operativos, record cards, status bands, tablas con profundidad y encabezados de módulo.
- El rediseño mantiene densidad operativa y no cambia permisos, APIs ni reglas de negocio.

**Contexto:**
- En comité se percibió la interfaz como plana y genérica.
- La app ya tiene valor funcional; el reto era elevar jerarquía visual, identidad y escalabilidad del sistema de interfaz.

**Consecuencias:**
- Login, shell, dashboard, Exportaciones, Solicitudes Transporte y Usuarios quedan como referencia visual inicial.
- `globals.css` centraliza clases `op-*` para que el resto de módulos herede profundidad sin reescribir toda la lógica.
- Logística, rutas, GPS y Mi Ruta siguen suspendidos.

**Archivos afectados:** `src/app/globals.css`, `src/components/common/*`, `src/components/control-logistico/*`, `src/app/(auth)/login/page.tsx`, pantallas clave del dashboard y `docs/cerebro/ux-ui.md`.

---

## 2026-06-16 - Modulo Exportaciones para etiquetado

**Decision:**
- Se crea el modulo **Exportaciones** para captura operativa de etiquetado de cajas.
- Se agregan roles `ETIQUETADO` y `SUPERVISOR_ALMACENAMIENTO`.
- `ETIQUETADO` solo ve Exportaciones; supervisor almacenamiento, admin y gerente gestionan.
- El PLU debe existir en `ProductoMaestro`; la descripcion siempre viene del maestro.
- La hora de inicio se toma al crear; la hora de finalizacion del registro anterior se cierra al crear el siguiente registro del mismo usuario.

**Contexto:**
- El area requiere medir y controlar etiquetado de exportaciones con trazabilidad por caja, PLU, unidad de empaque, fecha y tiempos.

**Consecuencias:**
- Nuevo modelo `EtiquetadoExportacion`.
- Nuevas APIs `/api/exportaciones` y `/api/exportaciones/[id]`.
- Nuevo modulo `/dashboard/exportaciones` responsive para PC, celular y tablet.
- Cambios de roles en Prisma, permisos, usuarios, sidebar, command palette y home actions.
- Logistica, rutas, GPS y Mi Ruta siguen suspendidos.

**Archivos afectados:** `prisma/schema.prisma`, `src/lib/exportaciones.ts`, `src/app/api/exportaciones/*`, `src/app/(dashboard)/dashboard/exportaciones/page.tsx`, permisos, usuarios y cerebro.

---

## 2026-06-16 - Solicitudes Transporte con PLUs, cajas y borrado logico

**Decision:**
- Solicitudes de Transporte captura PLUs por solicitud, cantidad cajas, flete condicional y detalle completo por secciones.
- `SolicitudTransporte.unidades` se conserva por compatibilidad, pero se expone en UI/API como **cantidad cajas**.
- La descripcion del PLU se autocompleta desde `ProductoMaestro`; si no existe, el solicitante puede escribirla manualmente.
- La transportadora de gestion transporte queda limitada a lista cerrada: ONE SITE, TRANSTELITAL, V2 TOGO, PROPIO, PROESLOG, PAKING TO GO, NOTA INTERNA.
- `ADMIN` y `GERENTE` pueden editar cualquier solicitud no eliminada y borrar logicamente.

**Contexto:**
- Transporte necesita que la solicitud interna reemplace mejor al Google Sheet, incluyendo mercancia por PLU, cajas y validaciones obligatorias.
- El borrado debe permitir corregir registros administrativos sin perder trazabilidad ni borrar historial.

**Consecuencias:**
- Nuevo modelo `PluSolicitudTransporte`.
- Nuevos campos `deletedAt`, `deletedById` y `deleteReason` en `SolicitudTransporte`.
- `GET` y detalle excluyen eliminadas y devuelven PLUs.
- `DELETE /api/solicitudes-transporte/[id]` ejecuta borrado logico solo para `ADMIN` y `GERENTE`.
- Logistica, rutas, GPS y Mi Ruta siguen suspendidos.

**Archivos afectados:** `prisma/schema.prisma`, `src/lib/solicitudesTransporte.ts`, `src/app/api/solicitudes-transporte/*`, `src/app/(dashboard)/dashboard/solicitudes-transporte/page.tsx`, `src/__tests__/solicitudesTransporte.test.ts`

---

## 2026-06-12 - Modulo Solicitudes de Transporte interno

**Decision:**
- Se crea el modulo interno **Solicitudes de Transporte** para reemplazar el Google Form/Sheet en nuevas solicitudes.
- No hay sincronizacion con Google Sheets ni importacion historica en v1.
- Todos los usuarios autenticados pueden crear solicitudes excepto `TRANSPORTISTA`.
- `SUPERVISOR_TRANSPORTE`, `GERENTE` y `ADMIN` gestionan Documento NetSuite, Stella, transportadora, guia, fecha de programacion y observacion.
- Stella alimenta estado y semaforo: PENDIENTE, PROGRAMADO, EFECTUADO, CANCELADO.

**Contexto:**
- Transporte necesitaba centralizar solicitudes de servicio y dejar de depender de un formulario externo para la operacion diaria.
- El flujo debe permitir rechazo con motivo, correccion y reenvio por parte del solicitante.

**Consecuencias:**
- Nuevos modelos `SolicitudTransporte` e `HistorialSolicitudTransporte`.
- Nuevos enums de estado, Stella, prioridad y semaforo.
- Nuevo modulo `solicitudes-transporte` en permisos, sidebar, command palette, home actions y resumen Control Logistico.
- Logistica, rutas, GPS y Mi Ruta siguen suspendidos.

**Archivos afectados:** `prisma/schema.prisma`, `src/lib/solicitudesTransporte.ts`, `src/app/api/solicitudes-transporte/*`, `src/app/(dashboard)/dashboard/solicitudes-transporte/page.tsx`, `src/lib/modulePermissions.ts`, `src/lib/moduleTheme.ts`, `src/components/common/Sidebar.tsx`, `src/components/ui/CommandPalette.tsx`, `src/config/homeActions.ts`

---

## 2026-06-12 - Plataforma Control Logistico CEDI

**Decision:**
- La identidad operativa vigente pasa de Torre CEDI a **Control Logistico CEDI**.
- El dashboard principal se convierte en una consola alimentada por una capa de resumen operacional por rol.
- Se crea `/api/control-logistico/resumen` como base para prioridades, flujo, modulos bajo control y acciones recomendadas.
- Se centraliza el nombre de producto en `src/config/product.ts`.

**Contexto:**
- La interfaz anterior funcionaba, pero seguia sintiendose como un SaaS generico con modulos conectados por pantalla.
- Para escalar, el producto necesita una capa comun de operacion y no duplicar fetches/calculos entre Dashboard, Mis Tareas y Centro de Control.

**Consecuencias:**
- Fases siguientes deben migrar shell, command palette y modulos clave hacia componentes de plataforma.
- Los componentes iniciales de plataforma viven en `src/components/control-logistico` y deben reutilizarse antes de crear bloques visuales nuevos.
- `src/__tests__/controlLogisticoResumen.test.ts` protege que el resumen no exponga modulos no visibles por rol.
- No hay cambios de base de datos en esta primera entrega.
- Logistica, rutas, GPS y Mi Ruta siguen suspendidos.

**Archivos afectados:** `src/config/product.ts`, `src/lib/controlLogistico/*`, `src/components/control-logistico/*`, `src/app/api/control-logistico/resumen/route.ts`, `src/app/(dashboard)/dashboard/page.tsx`, `src/components/common/*`, `src/components/ui/CommandPalette.tsx`, `src/__tests__/controlLogisticoResumen.test.ts`

---

## 2026-06-12 - Fase 4 UI: pulido operativo y QA predeploy

**Decision:**
- Cerrar Fase 4 con mejoras pequeñas de alto impacto en Usuarios, Tienda, Conteo, Preoperacional y Dashboard.
- Usuarios mantiene la gestion minima de vehiculos/transportistas dentro del modulo Admin, usando colores de `moduleTheme`.
- Tienda mejora microcopy de instrucciones de entrega sin cambiar estados ni permisos.
- Conteo y Preoperacional mejoran estados vacios/error para que la operacion entienda el siguiente paso.
- Dashboard suma todas las alertas visibles por rol y trata rechazos de Tienda como prioridad critica.

**Contexto:**
- Fase 3 ya entrego la Torre CEDI por rol, pero Fase 4 necesitaba cerrar inconsistencias de microcopy, vacios y señales visuales.
- La app debe seguir compacta y operativa; esta fase no busca rediseño completo ni una apariencia promocional.

**Consecuencias:**
- No hay cambios de schema, APIs ni permisos server-side.
- No se reactivan Logistica, GPS, rutas ni Mi Ruta.
- El QA visual con sesion real por rol queda como validacion manual post-deploy si no hay credenciales disponibles en el entorno.

**Archivos afectados:** `src/app/(dashboard)/dashboard/page.tsx`, `src/app/(dashboard)/dashboard/usuarios/page.tsx`, `src/app/(dashboard)/dashboard/tienda/page.tsx`, `src/app/(dashboard)/dashboard/conteo/page.tsx`, `src/app/(dashboard)/dashboard/conteo/contar/page.tsx`, `src/config/homeActions.ts`, `docs/cerebro/ux-ui.md`, `docs/cerebro/pendientes.md`

---

## 2026-06-12 - Fase 3 UI: Dashboard Torre CEDI por rol

**Decision:**
- El inicio `/dashboard` se convierte en Torre CEDI operativa con flujo, prioridades y KPIs por rol.
- ADMIN/GERENTE ven flujo general Inventario → Tienda → CEDI → Conteo, prioridades críticas y actividad reciente.
- SUPERVISOR_TRANSPORTE ve señales de Tienda, CEDI, guardados y pendientes por guardar.
- TRANSPORTE ve pendientes de guardado y guardados por despachar.
- TIENDA/SUPERVISOR_TIENDA ven solicitudes creadas, rechazadas, con novedad y enviadas.
- TRANSPORTISTA conserva una vista enfocada únicamente en Preoperacional.

**Contexto:**
- Fase 2 dejó el shell y la command palette estabilizados.
- El dashboard todavía funcionaba como una suma de tarjetas, pero no como tablero de operación diaria.

**Consecuencias:**
- No se crean APIs nuevas; se reutilizan `/api/stats`, `/api/activity`, `/api/novedades`, `/api/transporte`, `/api/tienda` y `/api/transporte/pendientes-tienda`.
- No hay cambios de schema ni permisos server-side.
- Logística, GPS, rutas y Mi Ruta siguen suspendidos.

**Archivos afectados:** `src/app/(dashboard)/dashboard/page.tsx`, `docs/cerebro/ux-ui.md`, `docs/cerebro/pendientes.md`

---

## 2026-06-12 - Fase 2 UI: shell operativo y command palette por rol

**Decision:**
- El shell principal ahora expone contexto de rol y alcance visible en el header.
- El sidebar mantiene `canSeeModule` como filtro único de navegación y mejora la señal visual del módulo activo.
- La command palette funciona como centro de mando por rol: acciones y navegación solo aparecen si el usuario puede ver el módulo.
- La búsqueda viva de la command palette no consulta APIs de módulos no visibles para el rol actual.

**Contexto:**
- Después de Fase 1, la identidad modular ya existía, pero el shell seguía sintiéndose genérico.
- Fase 2 buscaba mejorar navegación, command palette y microcopy sin rediseñar dashboards completos ni tocar reglas de negocio.

**Consecuencias:**
- La Fase 3 puede enfocarse en Dashboard/Torre CEDI usando el shell ya estabilizado.
- No se reactivan Logística, GPS, rutas ni Mi Ruta.
- No hay cambios de schema, APIs ni permisos server-side.

**Archivos afectados:** `src/components/common/Header.tsx`, `src/components/common/Sidebar.tsx`, `src/components/ui/CommandPalette.tsx`, `docs/cerebro/ux-ui.md`, `docs/cerebro/pendientes.md`

---

## 2026-06-11 - Cierre Fase 1 UI post-Claude

**Decision:**
- Los cambios nuevos de Tienda y Preoperacional deben integrarse a la identidad modular antes de iniciar Fase 2.
- `RECHAZADO` usa rojo solo como señal semántica de bloqueo; las acciones de corrección/re-envío pertenecen al módulo Tienda y usan ámbar.
- Las acciones de guardado asignadas desde Tienda pertenecen al módulo Transporte y usan cian.
- El detalle de inspecciones preoperacionales usa `moduleTheme.preoperacional` en enlaces, encabezados y acciones.

**Contexto:**
- Claude Code agregó rechazo de solicitudes de despacho, edición en `RECHAZADO` y vista detallada de inspecciones preoperacionales.
- Esos cambios eran correctos funcionalmente, pero mezclaban colores hardcodeados de otros módulos.

**Consecuencias:**
- Fase 2 puede concentrarse en shell, command palette y navegación sin arrastrar inconsistencias visuales de Fase 1.
- `docs/cerebro/base-datos.md` y `docs/cerebro/estados-despacho.md` quedan alineados con `schema.prisma`.

**Archivos afectados:** `src/app/(dashboard)/dashboard/tienda/page.tsx`, `src/app/(dashboard)/dashboard/preoperacional/page.tsx`, `src/app/api/tienda/[id]/route.ts`, `docs/cerebro/*`

---

## 2026-06-11 — Rechazo de solicitudes de despacho por transporte

**Decision:**
- Se agrega el estado `RECHAZADO` al enum `EstadoDespacho` con flujo bidireccional: `CREADO_TIENDA → RECHAZADO → CREADO_TIENDA`.
- Solo SUPERVISOR_TRANSPORTE, GERENTE y ADMIN pueden rechazar; requieren motivo (mín. 5 chars).
- Al rechazar: notificación automática al creador del despacho.
- TIENDA/SUPERVISOR_TIENDA ven un "cajón" visual prominente con los rechazados y el motivo; pueden **editar** los datos y luego **re-enviar** con un clic.
- La edición mientras RECHAZADO está permitida para TIENDA en API y UI — el estado no cambia al editar, solo al re-enviar.
- **TIENDA no puede editar en CREADO_TIENDA** — solo en RECHAZADO. SUPERVISOR_TIENDA y superiores sí pueden editar en CREADO_TIENDA.
- Se eligió nuevo estado `RECHAZADO` (en vez de reutilizar `CON_NOVEDAD`) porque CON_NOVEDAD es terminal y semánticamente diferente.

**Contexto:**
- El área de transporte necesitaba poder devolver despachos con datos incorrectos (PLUs erróneos, documentos incompletos) sin rechazar el flujo completo ni acumular novedades operativas.

**Consecuencias:**
- Nuevos campos en `DespachoTienda`: `motivoRechazo String?`, `rechazadoAt DateTime?`
- Se limpian al re-enviar (RECHAZADO → CREADO_TIENDA)
- `src/lib/tiendaFlow.ts`, `src/lib/tienda.ts`, `src/app/api/tienda/[id]/route.ts`, `src/app/(dashboard)/dashboard/tienda/page.tsx`

---

## 2026-06-11 - Identidad visual Torre CEDI y tema modular

**Decision:**
- La interfaz adopta el nombre operativo **Torre CEDI** para shell, metadata y navegación principal.
- Se crea una fuente central de identidad visual por módulo en `src/lib/moduleTheme.ts`.
- Sidebar, command palette, acciones rápidas y dashboard deben consumir colores desde el tema modular.
- Tienda queda ámbar (`#D97706`) e Integración queda violeta (`#7C3AED`) para evitar colisión visual.

**Contexto:**
- La UI funcionaba correctamente, pero se percibía genérica y con colores hardcodeados en varios lugares.
- Tienda aparecía en algunos accesos con color violeta, compitiendo con Integración de Pedidos.
- La app necesita diferenciarse como herramienta operativa propia de Grupo Ambiente CEDI.

**Consecuencias:**
- Nuevos cambios visuales deben partir de `moduleTheme`.
- La primera fase no cambia permisos, APIs, schema ni flujos de negocio.
- Logística, GPS, rutas y Mi Ruta siguen suspendidos.

**Archivos afectados:** `src/lib/moduleTheme.ts`, `src/components/common/Sidebar.tsx`, `src/components/common/Header.tsx`, `src/components/ui/CommandPalette.tsx`, `src/config/homeActions.ts`, `src/app/(dashboard)/dashboard/page.tsx`, `src/app/(dashboard)/dashboard/centro-control/page.tsx`, `src/app/globals.css`

---

## 2026-06-11 - Estabilizacion de seguridad en archivos Excel e imagenes

**Decision:**
- Se reemplaza `xlsx` por `exceljs` para lectura/escritura de archivos XLSX.
- Los importadores validan extension, tamano maximo y limite de filas antes de procesar.
- El upload de fotos solo acepta JPG, PNG y WebP; SVG queda rechazado.
- `/api/stats` queda restringido a `ADMIN` y `GERENTE`.

**Contexto:**
- `npm audit` reporto vulnerabilidad alta sin fix disponible en `xlsx`.
- Los importadores y uploads aceptaban entradas demasiado amplias para una app interna en produccion.
- `npm audit fix --force` proponia cambios incompatibles; no se usa.

**Consecuencias:**
- `POST /api/productos-maestro/importar` acepta `.xlsx`.
- `POST /api/conteo/ciclos/[id]/importar` acepta `.xlsx` y `.csv`.
- Las exportaciones XLSX usan `exceljs`.
- Quedan vulnerabilidades moderadas indirectas de `next`/`prisma` para monitoreo hasta upgrades seguros.

**Archivos afectados:** `src/lib/excel.ts`, `src/lib/fileSecurity.ts`, APIs de importacion/exportacion, `src/app/api/uploads/foto/route.ts`, `src/app/api/stats/route.ts`

---

## 2026-06-10 — Suspensión de logística, rutas y GPS

**Decisión:**
- El módulo Logística queda **suspendido indefinidamente** como proyecto futuro
- Se eliminan rutas y asignación de rutas del flujo operativo actual
- El conductor (rol `TRANSPORTISTA`) queda limitado **únicamente** al módulo Preoperacional
- El flujo principal queda definido como: **Tienda → Supervisor Transporte → CEDI → Cliente**

**Contexto:**
- La implementación de GPS, rutas y asignación de conductores a rutas es demasiado compleja para la fase actual del proyecto
- El equipo necesita primero consolidar el flujo básico de despachos antes de añadir logística avanzada
- NetSuite ya maneja parte del tracking; duplicar esa funcionalidad no agrega valor inmediato

**Consecuencias:**
- Los modelos `Ruta`, `Parada`, `UbicacionGPS`, `IncidenciaRuta` permanecen en el schema pero sin API routes activas
- El CLAUDE.md y AGENTS.md incluyen la instrucción explícita de no reactivar logística
- El sidebar no muestra ningún ítem de logística/rutas

**Archivos afectados:** `src/components/common/Sidebar.tsx`, `src/lib/modulePermissions.ts`, `CLAUDE.md`

---

## 2026-06-09 — Implementación del módulo Integración de Pedidos

**Decisión:**
- Se crea un módulo nuevo para coordinar el picking de órdenes OVDM/TSDM entre dos áreas operativas
- Se añaden 2 nuevos roles: `OPERACIONES_MUEBLES` y `OPERACIONES_GOURMET`
- Color del módulo: violeta `#7C3AED` (distinto a todos los módulos existentes)
- Flujo de 3 estados: PENDIENTE_AREA2 → LISTA_TRANSPORTE → COMPLETADA

**Contexto:**
- Las órdenes OVDM/TSDM pueden contener PLUs de dos áreas distintas
- No existía forma de coordinar el picking entre áreas; el proceso era manual y sin visibilidad
- La detección de duplicados (mismo número de documento) redirige automáticamente al modal de completar

**Archivos nuevos:**
- `src/app/(dashboard)/dashboard/integracion/page.tsx`
- `src/app/api/integracion/route.ts`
- `src/app/api/integracion/[id]/route.ts`
- Modelos en `prisma/schema.prisma`: `IntegracionPedido`, `PlinIntegracion`, `EstadoIntegracion`

---

## 2026-06 — Sprint 8: Simplificación del flujo de tienda

**Decisión:**
- Se simplificó el flujo de despachos de tienda eliminando la asignación a rutas
- El supervisor de transporte gestiona directamente los estados sin pasar por logística
- Se mantiene la capacidad de asignar conductor + vehículo para los despachos

**Contexto:**
- La complejidad del flujo con rutas generaba fricción operativa
- El equipo de tienda necesitaba un flujo más directo y fácil de operar

---

## 2026-06-10 — ADMIN puede eliminar preoperativos e integraciones

**Decisión:**
- El rol ADMIN puede eliminar inspecciones preoperacionales e integraciones de pedidos
- Ningún otro rol puede eliminar (matriz de permisos: `delete: ["ADMIN"]`)
- La confirmación es inline en la UI (botón Trash2 → "Sí, eliminar" / "Cancelar")

**Contexto:**
- Se necesita poder corregir registros erróneos o de prueba sin acceder a la base de datos directamente

**Consecuencias:**
- Nuevo: `src/app/api/preoperacional/[id]/route.ts` con DELETE
- Modificado: `src/app/api/integracion/[id]/route.ts` agrega DELETE
- UI: columna de acciones en `SupervisorView` (preoperacional) y zona de admin en SlidePanel (integración)
- Ambos registran `ActivityLog` con `action: "DELETE"`

---

## Plantilla para nuevas decisiones

```markdown
## YYYY-MM-DD — Título de la decisión

**Decisión:** Qué se decidió hacer (o no hacer).

**Contexto:** Por qué se tomó esta decisión.

**Consecuencias:** Qué cambió, qué archivos se afectaron.
```
