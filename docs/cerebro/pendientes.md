# Pendientes y Tareas

> Links: [[decisiones]] · [[bugs]] · [[estados-despacho]] · [[flujo-despachos]]

---

## Tareas pendientes

### Módulo Tienda / Despachos

- [ ] Quitar módulo logística del menú de navegación (confirmar que no aparece en Sidebar)
- [ ] Quitar asignación de rutas del flujo de despacho de tienda
- [ ] Agregar estados `ENTREGADO`, `GUARDADO`, `PENDIENTE_GUARDAR` al enum `EstadoDespacho` en `prisma/schema.prisma`
- [ ] Agregar campo de nota para dirección y datos de entrega en el formulario de creación de despacho
- [ ] Crear flujo completo para supervisor transporte (marcar recogido en tienda, llegó a CEDI, enviado a cliente)
- [ ] Crear vista de "pendientes por guardar" para el operario de transporte (`TRANSPORTE`)

### Permisos y roles

- [ ] Confirmar que `TRANSPORTISTA` solo ve Preoperacional (ya implementado — verificar en prod)
- [ ] Verificar que `OPERACIONES_MUEBLES` y `OPERACIONES_GOURMET` solo ven Integración de Pedidos

### Documentación

- [ ] Revisar si `HANDOFF.md` en la raíz está actualizado con el estado del Sprint 8
- [ ] Actualizar `docs/cerebro/` después de cada sprint

### Mejoras técnicas

- [ ] Revisar modelos de logística suspendidos — decidir si eliminarlos del schema o mantenerlos
- [ ] Verificar que todas las API routes de logística retornan 404 o 403

---

## Completadas ✅

- [x] Implementar módulo Integración de Pedidos (OVDM/TSDM) — 2026-06-09
- [x] Añadir roles OPERACIONES_MUEBLES y OPERACIONES_GOURMET — 2026-06-09
- [x] Exponer nuevos roles en la UI de gestión de usuarios — 2026-06-10
- [x] Mejoras de responsividad mobile en todas las páginas — Sprint 8
- [x] Mejoras de UX en tablas (sort, skeleton, EmptyState) — Sprint 8
- [x] Módulo Preoperacional completo para conductores — Sprint 8
- [x] Asignación de conductor + vehículo para despachos de tienda — Sprint 8

---

## Cómo usar este archivo

1. Añadir tareas nuevas con `- [ ]` al inicio de la sección correspondiente
2. Cuando una tarea se completa: cambiar a `- [x]` y moverla a "Completadas" con la fecha
3. Para bugs encontrados: añadir en [[bugs]] y referenciar aquí si afecta un flujo
