# Registro de Bugs

> Links: [[pendientes]] · [[modulos]] · [[api-endpoints]]

---

## Bugs abiertos

*(Ninguno registrado aún)*

---

## Bugs resueltos

## [BUG-003] Pedidos Gourmet duplicados al "corregir" un error de captura

- **Fecha detectado:** 2026-07-03
- **Módulo:** cargue-gourmet
- **Severidad:** 🟡 Media (genera pedidos fantasma, no pérdida de datos)
- **Reportado por:** Operación (usuarios del módulo Cargue Gourmet)
- **Descripción:**
  Cuando el operador se equivoca al capturar un pedido (p. ej. registra 1 caja en vez
  de 6) y luego intenta "corregirlo", en algunos casos termina apareciendo un segundo
  pedido con la misma orden en vez de quedar corregido el original.
- **Diagnóstico:**
  - `PUT /api/cargue-gourmet/[id]` (editar) **no puede duplicar** un registro: actualiza
    por `id`, nunca crea uno nuevo. El bug no estaba ahí.
  - Causa raíz real: `POST /api/cargue-gourmet` (crear) **no validaba si la orden ya
    existía**. El botón "Nuevo pedido" está siempre visible en el encabezado de la lista,
    mientras que "Editar pedido" solo aparece dentro del detalle de un pedido ya abierto
    (`GourmetAccionesBar.tsx`) — un paso adicional. Bajo presión operativa, es fácil que
    el operador use "Nuevo pedido" para corregir en vez de abrir el pedido y editarlo,
    y como no había ningún control de duplicados por `orden`, el sistema lo permitía
    silenciosamente, dejando dos filas con la misma orden (una con el dato erróneo).
- **Archivo(s) afectado(s):**
  - `src/app/api/cargue-gourmet/route.ts` (POST)
  - `src/app/api/cargue-gourmet/[id]/route.ts` (PUT)
  - `src/lib/apiClient.ts` (`ApiError` ahora propaga `data` del backend)
  - `src/app/(dashboard)/dashboard/cargue-gourmet/_components/CrearPedidoModal.tsx`
  - `src/app/(dashboard)/dashboard/cargue-gourmet/page.tsx`
  - `src/__tests__/cargueGourmetApi.test.ts`
- **Estado:** ✅ Resuelto
- **Solución aplicada:**
  - `POST` ahora rechaza con `409 ORDEN_DUPLICADA` si ya existe un pedido con la misma
    `orden` (comparación case-insensitive, trim) en cualquier estado distinto de
    `CANCELADO`, devolviendo `data: { id, estado }` del pedido en conflicto.
  - `PUT` aplica el mismo chequeo cuando el body cambia `orden` a un valor que ya usa
    **otro** pedido (excluye el propio `id`).
  - En el modal "Nuevo pedido Gourmet", si el backend responde `ORDEN_DUPLICADA`, se
    muestra el error y un botón **"Editar el pedido existente"** que abre directamente
    ese pedido en modo edición (`abrirExistenteYEditar` en `page.tsx`) — así la
    corrección se hace sobre el registro real en vez de crear uno nuevo.
  - `CANCELADO` libera la orden a propósito: un pedido anulado no debe bloquear que se
    vuelva a crear la misma orden si de verdad hace falta.
  - Validado: `tsc` + suite completa (944 tests) verdes. Sin verificación manual en
    navegador en esta sesión (dev server de otra sesión ya ocupaba el puerto).
- **Fecha resolución:** 2026-07-03

## [BUG-002] "Sin coincidencias" al buscar tienda en Nuevo pedido Gourmet

- **Fecha detectado:** 2026-06-25
- **Módulo:** cargue-gourmet
- **Severidad:** 🔴 Alta (bloqueaba crear pedidos Gourmet)
- **Reportado por:** QA visual del usuario
- **Descripción:**
  En el modal "Nuevo pedido Gourmet", al escribir el código de tienda `144` en el
  autocompletado, el campo mostraba "Sin coincidencias".
- **Comportamiento esperado:**
  Al escribir `144` debía aparecer la tienda `AG Viva Barranquilla` como sugerencia.
- **Comportamiento actual (antes del fix):**
  Cualquier código mostraba "Sin coincidencias", sin importar el valor escrito.
- **Diagnóstico:**
  - Frontend correcto.
  - Endpoint correcto (`GET /api/cargue-gourmet/maestro-tiendas?q=144`).
  - Backend correcto.
  - Causa real: la tabla `MaestroTiendaGourmet` no tenía datos cargados (estaba vacía).
- **Archivo(s) afectado(s):**
  - `scripts/import-maestro-tiendas-gourmet.mjs` (nuevo)
  - `scripts/lib/maestroTiendasCsv.mjs` (nuevo, con `normalizeRowKeys()`)
  - `data/maestro-tiendas-gourmet.example.csv` (nuevo)
  - `src/__tests__/maestroTiendasCsvImport.test.ts` (nuevo)
- **Estado:** ✅ Resuelto
- **Solución aplicada:**
  Se creó un script de importación CSV con modo dry-run (solo lectura) y modo `--apply`
  (upsert real por `codigo`). El parser se corrigió para aceptar cabeceras case-insensitive
  (`CODIGO`, `Codigo`, `codigo` tratadas igual) vía `normalizeRowKeys()`, ya que el CSV real
  (`CENTROS DE COSTOS.csv`) traía cabeceras en mayúsculas y con `;` como separador, distinto
  del formato esperado `codigo,tienda,ciudad,activo`. Validado el CSV real: 999 filas leídas,
  136 válidas, 863 inválidas (filas vacías `;;`), 0 duplicados. Ejecutado `--apply` en
  producción: 136 creados, 0 actualizados, 0 fallidos. Verificado en producción que el
  código `144` ahora resuelve a `AG Viva Barranquilla`.
- **Riesgos/observaciones:**
  - El maestro se cargó por script (one-off), no desde una UI de administración.
  - Futuro posible: construir un módulo/admin de mantenimiento del maestro de tiendas
    Gourmet si el negocio necesita altas/bajas recurrentes. No es bloqueante por ahora.
- **Fecha resolución:** 2026-06-25

## [BUG-001] Drawer de detalle vacío en Facturas Contado

- **Fecha detectado:** 2026-06-19
- **Módulo:** tienda
- **Severidad:** 🟡 Media
- **Reportado por:** Handoff EPIC B
- **Descripción:**
  Al abrir el detalle de una factura en `/dashboard/tienda`, el `SlidePanel` aparecía con título
  vacío, subtítulo literal `· #` y cuerpo sin pintar (sin `DetailSection`s).
- **Comportamiento esperado:**
  El panel abre con el encabezado y secciones de datos de la factura; el historial carga aparte.
- **Comportamiento actual (antes del fix):**
  Panel en blanco.
- **Archivo(s) afectado(s):**
  - `src/app/(dashboard)/dashboard/tienda/page.tsx` (`abrirPanel`, `<SlidePanel>` title/subtitle, sección Timeline)
- **Causa raíz:**
  Caché obsoleto de Turbopack/`.next` servido por un **dev server de larga vida en :3100**
  (confirmado: PID node.exe corriendo `next start-server.js` ocupando 3100). El código vigente
  ya pinta el encabezado desde la fila completa de la lista (`d`) antes del `fetch`, así que en un
  build limpio no queda vacío. No reproducible en preview headless por el muro de login
  (Auth.js `MissingSecret`: el secreto vive en el shell del usuario, no en un `.env` autoloaded).
- **Estado:** ✅ Resuelto
- **Solución aplicada:**
  Endurecido `abrirPanel` (renderiza desde `d`, **mergea** el detalle sobre `d`, no blanquea ante
  fallo, guarda contra carreras), guardas de título/subtítulo (elimina el `· #`), y skeleton de
  carga en la sección de historial. Build limpio: borrar `.next/` + reiniciar `npm run dev`.
  Defensa: el panel ya **no puede** quedar totalmente vacío sea cual sea la causa.
  Validado: `tsc` + 1176 tests + `npm run build` verdes.
- **Fecha resolución:** 2026-06-19

### Actualización 2026-06-20 — causa raíz real (QA del usuario en producción)

- **Reaparición:** el usuario reportó el "recuadro vacío" **en producción** (matec-cedi.vercel.app),
  donde no hay caché de Turbopack → el diagnóstico previo era incompleto.
- **Causa raíz real:** el `SlidePanel` **nunca se desmonta** (`SlidePanel.tsx:109`, "No unmount — solo
  transform"). Cerrado, queda montado y se empuja fuera de pantalla con `transform: translateX(width+20px)`
  (`SlidePanel.tsx:140`). Un elemento `position: fixed` desplazado más allá del borde derecho **genera
  scroll horizontal de página**; al desplazar a la derecha aparecía el panel cerrado, **vacío** (porque
  `panelItem` es `null` → sin `children`, `title=""`). El mismo overflow horizontal recortaba la columna
  Acciones de la tabla (la página entera se podía correr a la derecha). **Afectaba a todos los módulos
  con `SlidePanel`** (tienda, transporte, solicitudes, preoperacional, integracion, muebles, home).
- **Solución (global):** `overflow-x: clip` en `html`+`body` (`globals.css`) — `clip` y no `hidden` para
  no convertir el body en scroll-container ni romper el sidebar `sticky`. Además el `SlidePanel` cerrado
  pasa a `pointer-events: none` + `inert` (no foco/click del panel invisible).
- **Solución (tienda, tabla):** la "tabla cortada" era el mismo overflow horizontal de página → lo
  resuelve el `overflow-x: clip` global. El ancho natural de `.facturaTable` (~1180px) cabe en el cap de
  1400px de `.dash-main`, así que en pantallas normales se ve completa; en muy angostas queda el scroll
  interno contenido de `.tableScroll` (aceptable; el responsive fino se aborda en C4 con `<DataTable>`).
- **Validado:** `tsc` + 271 tests + `build` verdes. QA visual del usuario en :3100 pendiente de confirmar.
- **Archivos:** `src/app/globals.css`, `src/components/ui/SlidePanel.tsx`.

### Corrección 2026-06-20 (intento sticky revertido)

- Un primer intento fijó la columna Acciones con `position: sticky; right: 0` en `tienda.module.css`.
  **Se revirtió:** `position: sticky` en celdas `td`/`th` sobre una tabla con `border-collapse: collapse`
  es buggy en Chrome y **desincroniza el ancho de columnas entre `thead` y `tbody`** → cada encabezado
  mostraba el dato de la columna anterior (corrimiento de 1) y ESTADO quedaba recortado. Auditado: el
  patrón sticky-en-celda + collapse **solo** estaba en tienda; las demás tablas (`.ds-table`/`.cedi-table`)
  usan collapse pero sin celdas sticky. La tabla volvió a su layout original (alineado).

### Corrección 2026-06-20 (fix real del recuadro: clip-host, no clip en body)

- El `overflow-x: clip` en `html`/`body` **no recortaba** el panel: un elemento `position: fixed`
  tiene como **bloque contenedor el viewport**, no `body`/`html`, así que el `overflow` del root no
  lo afecta. El usuario seguía viendo el recuadro vacío al desplazar.
- **Fix real:** se envuelve el `SlidePanel` en un **clip-host** `position: fixed; inset: 0;
  overflow: hidden; transform: translateZ(0); pointer-events: none`. El `transform` lo convierte en
  bloque contenedor de descendientes `fixed`, así que su `overflow: hidden` **sí** recorta el panel
  cerrado off-screen → sin scroll horizontal de página ni "recuadro vacío". También recorta el caso
  móvil (bottom-sheet `translateY(100%)`). `pointer-events: none` deja pasar los clics; overlay y panel
  los reactivan. El `overflow-x: clip` de `html`/`body` se conserva como red de seguridad para overflow
  de elementos no-fixed.
- Una vez sin scroll de página, la tabla seguía cortando la columna Acciones por su ancho (~290px de
  botones). **Resuelto aparte (2026-06-20):** se quitó la columna Acciones inline y las acciones pasaron
  al `SlidePanel` de detalle (+Eliminar en el panel). Ver [[decisiones]].
- **Corrimiento de columnas (encabezado vs dato):** el cuerpo aparecía corrido ~1 columna a la derecha
  del encabezado (`thead` más angosto que `tbody`). Intentos que **no** lo cerraron: quitar la columna
  Acciones, quitar la columna vacía del ícono de alerta, y migrar a `.ds-table`. Estructura verificada
  correcta (5 `th` = 5 `td`, sin `colSpan`); sin regla global que rompa el layout; `.ds-table` alinea en
  otros módulos. Era un desincronizado de `table-layout: auto` no atribuible a una regla concreta.
- **Fix definitivo (2026-06-20):** layout **determinista** — `table-layout: fixed` + `<colgroup>` con
  anchos explícitos (Fecha 13% / Centro 18% / Doc 15% / Cliente 34% / Estado 20%) en la tabla de
  `tienda/_components.tsx`. Con `table-layout: fixed` los anchos los fija solo el `colgroup`, idénticos
  para `thead` y `tbody`, así que el desincronizado es **estructuralmente imposible**. Se agregó
  `overflow-wrap: anywhere` en Doc/Cliente para que contenido largo envuelva sin desbordar la columna.
- **Validado:** `tsc` + 271 tests + `build` verdes. QA visual del usuario pendiente.
- **Archivos:** `src/components/ui/SlidePanel.tsx`; `tienda/{_components.tsx,page.tsx,tienda.module.css}`.

### Rediseño visual de la tabla 2026-06-20 (densidad, jerarquía, leyenda)

- **Contexto:** tras cerrar el corrimiento, el usuario reportó que la tabla aún se veía pesada (tipografía
  grande, mucho alto de fila), el nombre de cliente rompía la lectura, el ícono de alerta no tenía contexto
  y los colores del rail lateral no se explicaban. El mapeo de datos ya era correcto (Estado = `<Badge>`,
  no cliente); el corrimiento histórico fue lo que daba la falsa impresión de "Estado mostrando clientes".
- **Cambios (solo UI, sin backend ni endpoints):**
  - Densidad compacta **scoped** vía `.facturasTableWrap :global(.ds-table)` (font 12.5px, th 10.5px, td
    height 42px) → especificidad (0,2,1) > `.ds-table td` (0,1,1), así **no afecta** otros módulos.
  - Cliente: nombre truncado (`ellipsis` + `title`) + 2ª línea `documento · teléfono` (antes solo teléfono).
  - Doc/Centro: truncado con `title`. Centro bajó de `font-weight 800` a `600`.
  - Badge de estado robusto: helper `EstadoBadge` con fallback **"Sin estado"** (variant `muted`) si llega
    estado nulo/desconocido desde la API.
  - Ícono de alerta: `<title>` SVG nativo (tooltip al hover) + entrada en la leyenda.
  - **Leyenda** `StateLegend` al pie de la tabla: dot de color + label por cada estado presente + "+24 h sin
    recogida" → explica el rail lateral y el ícono.
  - Anchos `colgroup` rebalanceados (Cliente 34%→30%, Doc 15%→21%) para que el nombre no domine.
- **Sin tocar:** orden de columnas, `onSort`/`sortCol`, `is-selected`, filtros/búsqueda, `abrirPanel`.
- **Validado:** `tsc` + 271 tests + `build` verdes. QA visual del usuario pendiente.
- **Archivos:** `tienda/{_components.tsx,tienda.module.css}`.

---

## Plantilla para registrar un bug

Copiar y pegar en la sección correspondiente (abierto o resuelto):

```markdown
## [BUG-XXX] Título descriptivo del bug

- **Fecha detectado:** YYYY-MM-DD
- **Módulo:** tienda | transporte | integracion | preoperacional | inventario | usuarios | otro
- **Severidad:** 🔴 Alta | 🟡 Media | 🟢 Baja
- **Reportado por:** (nombre o rol)
- **Descripción:**
  Qué está fallando y en qué contexto.
- **Pasos para reproducir:**
  1. Ir a...
  2. Hacer clic en...
  3. Observar que...
- **Comportamiento esperado:**
  Lo que debería pasar.
- **Comportamiento actual:**
  Lo que está pasando.
- **Archivo(s) afectado(s):**
  - `src/app/api/...`
  - `src/app/(dashboard)/dashboard/...`
- **Posible causa:**
  (Si se identificó)
- **Estado:** 🔴 Abierto | 🟡 En progreso | ✅ Resuelto
- **Solución aplicada:**
  (Si se resolvió) Qué se cambió y en qué commit.
- **Fecha resolución:** YYYY-MM-DD
```

---

## Cómo reportar un bug en una conversación con Claude

Usar el prompt de corrección de bugs de [[prompts]]:

```
Lee docs/cerebro/bugs.md, el archivo docs/cerebro/[módulo afectado].md 
y el estado actual del código en [ruta del archivo].

El bug es:
- Módulo: [módulo]
- Descripción: [qué falla]
- Pasos para reproducir: [pasos]
- Comportamiento esperado: [qué debería pasar]

Primero diagnostica la causa raíz, luego propón la solución.
Valida con npx tsc --noEmit y npm test antes de hacer push.
```
