# Pendientes y Tareas

> Links: [[decisiones]] - [[bugs]] - [[estados-despacho]] - [[flujo-despachos]]

---

## Tareas pendientes

### Modulo Tienda / Despachos

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

- [ ] QA visual desktop/mobile con sesion real por rol de Login, Dashboard, Usuarios, Tienda, Conteo y Preoperacional
- [ ] Fase plataforma 2: migrar Header/Sidebar/Command Palette a componentes de shell reutilizables
- [ ] Fase plataforma 3: agregar preferencias de usuario y vistas operativas guardadas
- [ ] Fase plataforma 4: aplicar ModulePageShell a Tienda, Transporte, Inventario y Conteo
- [x] Vista de detalle de inspecciones preoperacionales en la app (SlidePanel con checklist) — 2026-06-10
- [x] Checklist preoperacional completo con 58 ítems reales en 15 categorías — 2026-06-10

### Mejoras tecnicas

- [ ] Revisar modelos de logistica suspendidos: decidir si eliminarlos del schema o mantenerlos documentados como proyecto futuro
- [ ] Verificar que `/api/logistica/*` retorna 410
- [ ] Monitorear vulnerabilidades moderadas indirectas de `next` y `prisma` hasta que haya upgrades seguros

---

## Completadas

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

---

## Como usar este archivo

1. Anadir tareas nuevas con `- [ ]` al inicio de la seccion correspondiente.
2. Cuando una tarea se completa: cambiar a `- [x]` y moverla a "Completadas" con la fecha.
3. Para bugs encontrados: anadir en [[bugs]] y referenciar aqui si afecta un flujo.
