# Registro de Bugs

> Links: [[pendientes]] · [[modulos]] · [[api-endpoints]]

---

## Bugs abiertos

*(Ninguno registrado aún)*

---

## Bugs resueltos

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
