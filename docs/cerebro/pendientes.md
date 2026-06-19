# Pendientes y Tareas

> Links: [[decisiones]] - [[bugs]] - [[estados-despacho]] - [[flujo-despachos]]

---

## Tareas pendientes

### Fix rediseño Neon (2026-06-18)

- [x] Coherencia claro/oscuro: quitar el forzado dark `!important` global; acotar superficies neón a `html[data-theme="dark"]`. `body` coherente por tema.
- [x] Glow controlado (KPI/hero) + asset 3D del hero `cover`→`contain` (sin recorte).
- [x] Exportaciones: filtro de productividad por operario (cliente, sin cambio de API).
- [x] Exportaciones: KPI de productividad por operario **acumulado y filtrable por rango de días** (`desde`/`hasta` + atajos Hoy/7/30 días, default últimos 7 días); endpoint `GET /api/exportaciones/stats` acepta rango. — 2026-06-18
- [x] **ModuleHero patrón real**: asset 3D como elemento `<img>` controlado (`.module-hero-media`), no `::after`; layout desktop texto+asset, tablet reducido, móvil oculto. Headers legacy conservan `::after` hasta migrarse.
- [x] Mojibake reparado en `src/lib/netsuite.ts` (comentarios). Cadenas de UI ya estaban correctas.
- [x] **Consolidar los 3 bloques `:root` apilados** en `globals.css` en una sola fuente de verdad (criterio: cero cambio de valor computado; migrar radii/tipografía/layout/semánticos del primer `:root` y eliminar las eras v5/Colorido duplicadas). Riesgo medio — requiere diff cuidadoso, hacerlo como paso dedicado.
- [x] Migrar headers legacy visibles de Facturas Contado, Solicitudes Transporte, Usuarios y Auditoria a `ModuleHero`; quedan compat styles para pantallas legacy secundarias.
- [ ] **QA visual con capturas** en 1440px / 768px / 390px, claro y oscuro, en las 12 pantallas; comparar contra referencias aprobadas. Requiere app levantada.
- [ ] Verificar en vivo: TRANSPORTISTA solo Preoperacional · ETIQUETADO solo Exportaciones · Logística/Rutas/GPS/Mi Ruta ausentes.

### Rediseño premium Vercel/Linear (Design System v6)

- [x] **Fase 1** — Fundación: paleta gris neutra, sombras suaves, componentes reutilizables (`PageShell`, `Modal`/`ConfirmModal`, `DataTable`, `form`), `CediPage`→alias, charts sin hex muertos. (2026-06-18)
- [x] **Fase 2** — Studio premium, Home (fix acentos `--module-color`), Auditoría, Usuarios, Tienda, Muebles, Exportaciones migradas; `inventario` se mantiene mobile-first (bottom-sheet) con fixes seguros. Modales CRUD ad-hoc → `Modal`/`ConfirmModal` compartido. (2026-06-18)
- [x] **Fase 3** — Reorientada a Colorido Completo Enterprise: `preoperacional`, `integracion`, `conteo/contar`, `solicitudes-transporte`, `centro-control`, `mis-tareas`, rails de estado, superficies por módulo y barrido responsive base. (2026-06-18)
- [ ] Backlog Studio (no incluido en restyle): autosave con debounce 2s, preview de datos al conectar Sheets, gráficas línea/pastel, validación de fórmulas, filtros por parámetros.

### Módulo Studio — Fase 2

- [ ] Gráficos adicionales: Línea y Pie usando Chart.js (ya instalado)
- [ ] Filtros interactivos: Filtro fecha, Filtro texto, Filtro categoría (afectan todos los componentes del dashboard)
- [ ] Datos Combinados: LEFT JOIN entre dos hojas del mismo Sheet (por campo común)
- [ ] Publicar/compartir: cambiar estado BORRADOR → PUBLICADO, URL pública de solo lectura
- [ ] Google Sheets privados: conexión via service account
- [ ] Tests unitarios: studio-formula.ts (evaluateFormula), studio-sheets.ts (extractSheetId, detectColumns)
- [ ] QA visual Desktop/Mobile con sesión real (ADMIN y SUPERVISOR)
- [ ] Imagen/logo: componente StudioImagen con URL configurable

### Modulo Tienda / Facturas Contado

- [x] Redisenio visual modular de Facturas Contado como pantalla patron: componentes locales, CSS module, hero neon, KPIs, pipeline, filtros, tabla premium y drawer de detalle - 2026-06-19
- [ ] QA visual con sesion real de Facturas Contado en desktop/tablet/mobile y claro/oscuro; la captura headless local llego a login por falta de sesion compartida.
- [ ] Verificar en produccion que el sidebar no muestra Logistica, Rutas, GPS ni Mi Ruta
- [ ] Smoke test de flujo Tienda: CREADO_TIENDA -> RECOGIDO_TIENDA -> ENTREGADO_CEDI -> ENVIADO_CLIENTE
- [ ] Smoke test de rechazo: SUPERVISOR_TRANSPORTE rechaza → TIENDA ve cajón → edita datos → re-envía → vuelve a CREADO_TIENDA
- [ ] Smoke test de pendientes por guardar para operario `TRANSPORTE`

### Permisos y roles

- [ ] Confirmar en produccion que `TRANSPORTISTA` solo ve Preoperacional
- [ ] Verificar en produccion que `OPERACIONES_MUEBLES` y `OPERACIONES_GOURMET` solo ven Integracion de Pedidos

### Documentacion

- [ ] Revisar si `HANDOFF.md` en la raiz esta actualizado con el estado del Sprint 8
- [ ] Actualizar `docs/cerebro/` despues de cada sprint

### UI / UX Control Logistico CEDI

- [x] Rediseño Colorido Neon con assets por modulo: `ModuleHero`, renders en `public/ui/module-heroes`, headers dark/neon en claro/oscuro, KPIs con glow y tablas con rails - 2026-06-18
- [ ] Migrar pantallas legacy clave a componentes `CediPage/CediPanel/CediStat` por fases
- [ ] QA visual real de Indicadores CEDI en desktop, tablet y movil con datos sincronizados
- [x] Adaptar Indicadores CEDI a estructura real del Sheet (Base general + Rotacion PLU) — 2026-06-17
- [x] Indicadores CEDI con graficas ejecutivas: BarGroupedChart, LineTrendChart, DonutChart, HBarChart via `src/components/ui/charts.tsx` — 2026-06-17
- [x] Fase 2 UI: CediPage aplicado a Transporte (Guardados) y Conteo — Inventario excluido por diseno fullscreen movil intencional — 2026-06-17
- [ ] QA visual con sesion real de Colorido Completo Enterprise en claro/oscuro, desktop, tablet y movil
- [x] Revisar mojibake visible en pantallas tocadas; los archivos UI modificados quedaron sin marcadores corruptos conocidos.
- [ ] QA visual con sesion real por rol para Dashboard, Facturas Contado, Solicitudes Transporte, Exportaciones, Indicadores, Preoperacional, Integracion, Conteo/Contar, Centro de Control y Mis Tareas
- [ ] Extender datos en vivo a pantallas secundarias que aun usan carga manual si la operacion lo requiere
- [ ] QA visual desktop/mobile con sesion real por rol de Login, Dashboard, Usuarios, Tienda, Conteo y Preoperacional
- [ ] Fase plataforma 2: extender componentes `op-*` a Tienda, Transporte, Inventario, Conteo, Preoperacional, Integracion, Auditoria y Mis Tareas con QA visual por rol
- [ ] Fase plataforma 3: agregar preferencias de usuario y vistas operativas guardadas
- [ ] Fase plataforma 4: consolidar `ModulePageShell` si la repeticion de encabezados operativos vuelve a crecer
- [x] Vista de detalle de inspecciones preoperacionales en la app (SlidePanel con checklist) — 2026-06-10
- [x] Checklist preoperacional completo con 58 ítems reales en 15 categorías — 2026-06-10

### Mejoras tecnicas

- [ ] Revisar modelos de logistica suspendidos: decidir si eliminarlos del schema o mantenerlos documentados como proyecto futuro
- [ ] Verificar que `/api/logistica/*` retorna 410
- [ ] Monitorear vulnerabilidades moderadas indirectas de `next` y `prisma` hasta que haya upgrades seguros

---

## Completadas

- [x] Redirección visual vigente: abandonar azul/gris como restricción y adoptar Colorido Completo Enterprise module-aware/state-aware - 2026-06-18
- [x] Implementar modulo Integracion de Pedidos (OVDM/TSDM) - 2026-06-09
- [x] Anadir roles OPERACIONES_MUEBLES y OPERACIONES_GOURMET - 2026-06-09
- [x] Exponer nuevos roles en la UI de gestion de usuarios - 2026-06-10
- [x] Mejoras de responsividad mobile en todas las paginas - Sprint 8
- [x] Mejoras de UX en tablas (sort, skeleton, EmptyState) - Sprint 8
- [x] Modulo Preoperacional completo para conductores - Sprint 8
- [x] Asignacion de conductor + vehiculo para despachos de tienda - Sprint 8
- [x] Retirar estados obsoletos de la planificacion de Tienda (`ENTREGADO`, `GUARDADO`, `PENDIENTE_GUARDAR`) - 2026-06-11
- [x] Reemplazar `xlsx` por `exceljs` y endurecer uploads/importadores - 2026-06-11
- [x] Fase 1 UI: identidad Torre CEDI, tema modular y colores consistentes por modulo - 2026-06-11
- [x] Revisión Fase 1 post-Claude: Tienda RECHAZADO, guardado y Preoperacional alineados al tema modular - 2026-06-11
- [x] Fase 2 UI: shell operativo, sidebar v2.3 y command palette por rol - 2026-06-12
- [x] Fase 3 UI: Dashboard Torre CEDI con flujo operativo y prioridades por rol - 2026-06-12
- [x] Fase 4 UI: pulido de Usuarios, Tienda, Conteo, Preoperacional y alertas del Dashboard - 2026-06-12
- [x] QA tecnico predeploy: TypeScript, tests y build para cierre de Fases 3/4 - 2026-06-12
- [x] Inicio plataforma Control Logistico CEDI: identidad central, API de resumen y dashboard operativo inicial - 2026-06-12
- [x] Rechazar solicitud de despacho con motivo, cajón de rechazados para TIENDA, re-envío — 2026-06-11
- [x] Permitir edición de datos del despacho en estado RECHAZADO antes de re-enviar — 2026-06-11
- [x] Restringir TIENDA: solo puede editar despachos en RECHAZADO, no en CREADO_TIENDA — 2026-06-11
- [x] Modulo Solicitudes de Transporte interno con rechazo, correccion, gestion Stella y semaforo — 2026-06-12
- [x] Renombrar modulo "Despachos Tienda" → "Facturas Contado" en toda la UI (sidebar, command palette, home actions, page, modales) — 2026-06-13

- [x] Solicitudes Transporte: cantidad cajas, PLUs, flete condicional, detalle completo, transportadora cerrada y borrado logico admin/gerente - 2026-06-16
- [x] Modulo Exportaciones para etiquetado: roles ETIQUETADO/SUPERVISOR_ALMACENAMIENTO, PLU maestro obligatorio, tiempos automaticos y UI responsive - 2026-06-16
- [x] Modulo Studio MVP: builder de dashboards conectado a Google Sheets, editor 3 paneles drag-and-drop, KPI/Tabla/BarChart, campos formulados, parametros, guardado JSON en BD - 2026-06-17
- [x] Exportaciones: campo reguero (hayReguero bool + cantidadReguero int?) en schema, API (POST/PATCH), UI toggle Si/No + campo condicional en captura y modal edicion, columna en tabla y card mobile - 2026-06-16
- [x] Restructuracion visual (bordes, sombras, tints, .ds-stat card, .ds-panel borde+sombra, hover tabla, btn-primary gradiente, helper getModuleIconBg, Stat con borderLeft, iconos header opacidad 26) - 2026-06-16
- [x] Exportaciones: boton "Finalizar rotulacion" — endpoint POST /api/exportaciones/[id]/finalize cierra horaFinalizacion sin requerir motivo; banner "Registro en curso" muestra el boton para cerrar la jornada manualmente - 2026-06-16

- [x] Rediseño Operativo Premium Control Logístico CEDI: base visual `op-*`, shell, login, dashboard, Exportaciones, Solicitudes Transporte y Usuarios - 2026-06-16
- [x] Rediseño Claro Ejecutivo Azul/Gris: paleta contenida, shell claro, login claro, moduleTheme monolineal y datos en vivo en pantallas principales - 2026-06-16
- [x] Restaurar colores semánticos: --success=verde, --warning=ambar en :root y dark mode; corregir overrides ds-badge y cedi-badge que los pisaban con azul/gris — 2026-06-17
- [x] Exportaciones: panel de productividad por operario con cajas, PLUs, finalizadas, tiempo total y promedio min/caja; endpoint GET /api/exportaciones/stats — 2026-06-17
- [x] Auditoría visual completa + refactor inline styles (Fases 0–5): quitar reguero UI, tokens semánticos, componentes base (Alert, Badge, ds-input/ds-input-lg/ds-btn), Sidebar/Header, páginas operativas clave (exportaciones, tienda, transporte, inventario), EmptyState unificado — 2026-06-17
- [x] Auditoría v2 profunda + rediseño: dark mode fix (tokens texto/borde, badges, inputs, cedi-* overrides), paleta superficies más diferenciadas, sombras más pronunciadas, inicio rediseñado (hero ds-card + KPIs inline, ModuleCard con color del módulo + borderLeft), badges consistentes en 4 módulos legacy, sidebar activo más visible, header search prominente — 2026-06-17

- [x] Revision predeploy Lovable/Base44: Lovable como referencia visual, Base44 como checklist comparativo, pulido azul/gris en Integracion, Mis Tareas y Centro de Control - 2026-06-16
- [x] Capa CEDI Harmony: fondo operativo sutil, semantica contenida y limpieza de colores rojo/verde/ambar/violeta/teal hardcodeados - 2026-06-16

---

## Como usar este archivo

1. Anadir tareas nuevas con `- [ ]` al inicio de la seccion correspondiente.
2. Cuando una tarea se completa: cambiar a `- [x]` y moverla a "Completadas" con la fecha.
3. Para bugs encontrados: anadir en [[bugs]] y referenciar aqui si afecta un flujo.
