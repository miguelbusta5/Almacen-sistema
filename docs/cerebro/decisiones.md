# Decisiones de Arquitectura y Producto

> Links: [[pendientes]] · [[modulos]] · [[flujo-despachos]]

Registro cronológico de decisiones importantes. Una entrada por decisión, con fecha, contexto y consecuencias.

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
