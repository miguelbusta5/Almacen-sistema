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
