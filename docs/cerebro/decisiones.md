# Decisiones de Arquitectura y Producto

> Links: [[pendientes]] · [[modulos]] · [[flujo-despachos]]

Registro cronológico de decisiones importantes. Una entrada por decisión, con fecha, contexto y consecuencias.

---

## 2026-06-11 — Rechazo de solicitudes de despacho por transporte

**Decision:**
- Se agrega el estado `RECHAZADO` al enum `EstadoDespacho` con flujo bidireccional: `CREADO_TIENDA → RECHAZADO → CREADO_TIENDA`.
- Solo SUPERVISOR_TRANSPORTE, GERENTE y ADMIN pueden rechazar; requieren motivo (mín. 5 chars).
- Al rechazar: notificación automática al creador del despacho.
- TIENDA/SUPERVISOR_TIENDA ven un "cajón" visual prominente con los rechazados y el motivo; pueden **editar** los datos y luego **re-enviar** con un clic.
- La edición mientras RECHAZADO está permitida en API y UI — el estado no cambia al editar, solo al re-enviar.
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
