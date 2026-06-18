# Decisiones de Arquitectura y Producto

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
