# Módulos del Sistema

> Links: [[00-master-context]] · [[roles-permisos]] · [[flujo-despachos]] · [[pendientes]]

---

## Módulos activos ✅

| ModuleKey | URL | Roles que lo ven | Descripción |
|---|---|---|---|
| `inventario` | `/dashboard/inventario` `/dashboard/muebles` | ADMIN, GERENTE, SUPERVISOR_INV, INVENTARIO, OPERADOR | Novedades de inventario (diferencias de PLU, posición, cantidad) |
| `transporte` | `/dashboard/transporte` | ADMIN, GERENTE, SUPERVISOR_TRA, TRANSPORTE, OPERADOR | Guardados en custodia del almacén |
| `solicitudes-transporte` | `/dashboard/solicitudes-transporte` | Todos excepto TRANSPORTISTA | Solicitudes internas de transporte y gestion por lider transporte |
| `tienda` | `/dashboard/tienda` | ADMIN, GERENTE, SUPERVISOR_TRA, SUPERVISOR_TIE, TIENDA | Despachos desde tienda hasta cliente |
| `preoperacional` | `/dashboard/preoperacional` | ADMIN, GERENTE, SUPERVISOR_TRA, TRANSPORTISTA | Inspección diaria de vehículos |
| `conteo` | `/dashboard/conteo` | ADMIN, GERENTE, SUPERVISOR_INV, INVENTARIO | Gestión de ciclos de conteo cíclico |
| `conteo-contar` | `/dashboard/conteo/contar` | ADMIN, GERENTE, SUPERVISOR_INV, INVENTARIO, OPERADOR | Conteo de PLUs asignados |
| `mis-tareas` | `/dashboard/mis-tareas` | Todos excepto TRANSPORTISTA, OP_MUEBLES, OP_GOURMET | Tareas y pendientes del día |
| `usuarios` | `/dashboard/usuarios` | ADMIN | Gestión de usuarios, roles y flota |
| `auditoria` | `/dashboard/auditoria` | ADMIN, GERENTE | Historial de todas las acciones |
| `centro-control` | `/dashboard/centro-control` | ADMIN, GERENTE, supervisores | KPIs operacionales |
| `integracion` | `/dashboard/integracion` | ADMIN, GERENTE, SUPERVISOR_TRA, TRANSPORTE, OP_MUE, OP_GOU | Picking coordinado OVDM/TSDM |

---

## Módulos suspendidos ⛔

> **No reactivar en Sprint actual.** Ver [[decisiones]].

| Módulo | Razón de suspensión |
|---|---|
| Logística / Rutas | Proyecto futuro — demasiado complejo para fase actual |
| GPS / Tracking | Requiere infraestructura adicional |
| Mi Ruta | Depende de Logística (suspendido) |
| Flota (gestión avanzada) | Básico ya incluido en Usuarios |

Los modelos de datos para rutas y GPS **existen en el schema** (tabla `Ruta`, `UbicacionGPS`, `IncidenciaRuta`, `Parada`) pero sus API routes están deshabilitadas.

---

## Detalle de módulos clave

### Despachos Tienda (`tienda`)

El módulo más complejo. Incluye:
- Tabla con filtros por estado, búsqueda, paginación
- SlidePanel de detalle con historial
- Modales: crear despacho, editar, asignar conductor/vehículo, cambiar estado
- Flujo de estados en `src/lib/tiendaFlow.ts`
- Estadísticas: KPIs de despachos por estado

Archivos principales:
- `src/app/(dashboard)/dashboard/tienda/page.tsx`
- `src/app/api/tienda/route.ts`
- `src/app/api/tienda/[id]/route.ts`

### Integración de Pedidos (`integracion`) — Sprint 8 (último implementado)

Para coordinar picking de órdenes OVDM/TSDM entre dos áreas:
- Roles nuevos: `OPERACIONES_MUEBLES`, `OPERACIONES_GOURMET`
- 3 estados: PENDIENTE_AREA2 → LISTA_TRANSPORTE → COMPLETADA
- Detección de duplicados con redirección automática
- Notificaciones entre áreas

Archivos:
- `src/app/(dashboard)/dashboard/integracion/page.tsx`
- `src/app/api/integracion/route.ts`
- `src/app/api/integracion/[id]/route.ts`

### Solicitudes de Transporte (`solicitudes-transporte`)

Centraliza el formulario que antes se manejaba en Google Forms/Sheets:
- Solicitantes internos crean solicitudes desde la app
- `TRANSPORTISTA` queda excluido y sigue solo en Preoperacional
- `SUPERVISOR_TRANSPORTE`, `GERENTE` y `ADMIN` gestionan Documento NetSuite, Stella, transportadora, guia, fecha de programacion y observacion
- Stella alimenta estado y semaforo: PENDIENTE, PROGRAMADO, EFECTUADO, CANCELADO
- El rechazo funciona con motivo visible para el solicitante, correccion y reenvio

Archivos:
- `src/app/(dashboard)/dashboard/solicitudes-transporte/page.tsx`
- `src/app/api/solicitudes-transporte/*`
- `src/lib/solicitudesTransporte.ts`

### Novedades Inventario (`inventario`)

Registro de diferencias encontradas en el almacén:
- PLU, posición, cantidad, fabricante
- Estados: PENDIENTE → EN PROCESO → SOLUCIONADO
- Exportación a Excel (SheetJS/xlsx)

Archivos:
- `src/app/(dashboard)/dashboard/muebles/page.tsx`
- `src/app/api/novedades/route.ts`

### Preoperacional (`preoperacional`)

Solo para conductores (TRANSPORTISTA):
- Checklist de ítems por categoría
- Resultado por ítem: CONFORME / NO_CONFORME
- Estado final: APROBADA / APROBADA_CON_OBSERVACIONES / BLOQUEADA
- Exportación del reporte

---

## Fuentes de verdad para módulos

- Claves de módulos: `src/lib/modulePermissions.ts` → tipo `ModuleKey`
- Navegación: `src/components/common/Sidebar.tsx` → array `ALL_ITEMS`
- Command palette: `src/components/ui/CommandPalette.tsx` → acciones y búsqueda filtradas por `canSeeModule`
- Acciones rápidas del home: `src/config/homeActions.ts`
