# Base de Datos

> Links: [[00-master-context]] · [[estados-despacho]] · [[flujo-despachos]]

**Archivo fuente:** `prisma/schema.prisma`
**Conexión:** Railway PostgreSQL (`roundhouse.proxy.rlwy.net:24334`, DB `railway`)
**ORM:** Prisma 7 con `@prisma/adapter-pg`

---

## Comandos de base de datos

```bash
npx prisma db push        # Aplicar cambios del schema a Railway (sin migrations)
npx prisma generate       # Regenerar cliente Prisma (obligatorio después de editar schema)
npx prisma studio         # GUI para explorar datos (opcional)
node prisma/seed.js       # Crear usuario admin inicial
```

> ⚠️ Este proyecto usa `db push` directamente, **no usa migrations** (`prisma migrate`).
> Cada cambio al schema se aplica directo a Railway.

---

## Enums

| Enum | Valores |
|---|---|
| `Role` | ADMIN, GERENTE, OPERADOR, TRANSPORTISTA, INVENTARIO, TRANSPORTE, SUPERVISOR_INVENTARIO, SUPERVISOR_TRANSPORTE, TIENDA, SUPERVISOR_TIENDA, OPERACIONES_MUEBLES, OPERACIONES_GOURMET |
| `EstadoDespacho` | CREADO_TIENDA, RECOGIDO_TIENDA, ENTREGADO_CEDI, ENVIADO_CLIENTE, CON_NOVEDAD |
| `EstadoIntegracion` | PENDIENTE_AREA2, LISTA_TRANSPORTE, COMPLETADA |
| `EstadoInspeccion` | APROBADA, APROBADA_CON_OBSERVACIONES, BLOQUEADA |
| `ResultadoInspeccion` | CONFORME, NO_CONFORME |

---

## Modelos principales

### Auth y usuarios

| Modelo | Tabla | Propósito |
|---|---|---|
| `User` | `users` | Usuarios del sistema con rol |
| `Notificacion` | `notificaciones` | Notificaciones internas por usuario |
| `ActivityLog` | `activity_logs` | Auditoría de todas las acciones |

**Relaciones de User:**
- `activityLogs` → ActivityLog[]
- `transportista` → Transportista? (solo TRANSPORTISTA)
- `despachosTienda` → DespachoTienda[] (creados por)
- `inspecciones` → InspeccionPreoperacional[]
- `notificaciones` → Notificacion[]
- `integracionesCreadoras` → IntegracionPedido[]
- `integracionesCompletadas` → IntegracionPedido[]
- `ciclosConteo`, `guardadosPendientes`, `novedadesAsign`, `contactosGuard`

### Módulo Tienda

| Modelo | Tabla | Propósito |
|---|---|---|
| `DespachoTienda` | `despachos_tienda` | Despacho principal |
| `PlinDespacho` | `plines_despacho` | PLUs del despacho |
| `HistorialDespacho` | `historial_despachos` | Cambios de estado |
| `GuardadoPendienteTienda` | `guardados_pendientes_tienda` | Enlace despacho→guardado |

### Módulo Transporte

| Modelo | Tabla | Propósito |
|---|---|---|
| `TransporteGuardado` | `transporte_guardados` | Pedidos en custodia |
| `TransporteDeleted` | `transporte_deleted` | Registro de eliminados |
| `ContactoGuardado` | *(tabla propia)* | Contactos de clientes en guardados |
| `Transportista` | `transportistas` | Conductores operativos |
| `Vehiculo` | `vehiculos` | Flota de vehículos |

### Módulo Integración (Sprint 8)

| Modelo | Tabla | Propósito |
|---|---|---|
| `IntegracionPedido` | `integraciones_pedidos` | Orden de integración OVDM/TSDM |
| `PlinIntegracion` | `plines_integracion` | PLUs por área |

**Relaciones clave de IntegracionPedido:**
- `creadoPor` → User (relación "integracionesCreadoras")
- `completadoPor` → User? (relación "integracionesCompletadas")
- `plines` → PlinIntegracion[]

### Módulo Preoperacional

| Modelo | Tabla | Propósito |
|---|---|---|
| `InspeccionPreoperacional` | `inspecciones_preoperacionales` | Inspección diaria |
| `ItemInspeccion` | `items_inspeccion` | Resultado por ítem |

### Módulo Inventario / Conteo

| Modelo | Tabla | Propósito |
|---|---|---|
| `Novedad` | `novedades` | Diferencias de inventario |
| `ProductoMaestro` | `productos_maestro` | Catálogo de PLUs |
| `CicloConteo` | `ciclos_conteo` | Ciclo de conteo cíclico |
| `LineaConteo` | `lineas_conteo` | PLU individual a contar |
| `OperarioCiclo` | `operarios_ciclo` | Asignación de operarios |
| `ImportacionTeorico` | `importaciones_teorico` | Importación de datos WMS |

### Módulo Logística (suspendido)

Los modelos existen en schema pero las rutas API están deshabilitadas:
`Ruta`, `Parada`, `UbicacionGPS`, `IncidenciaRuta`

---

## Patrón de índices

Los modelos usan `@@index([campo, createdAt])` para queries frecuentes.
Los campos mapeados usan `@map("snake_case")` para mantener convención PostgreSQL.
