# API Endpoints

> Links: [[00-master-context]] · [[roles-permisos]] · [[base-datos]]

**Prefijo base:** `/api/`
**Auth:** Todas las rutas protegidas con Auth.js v5 JWT.

---

## Patrones de autenticación y autorización

```ts
// Autenticar (cualquier sesión válida)
const actor = await requireAuth();
if (actor instanceof NextResponse) return actor;

// Exigir rol específico
const actor = await requireRole(["ADMIN", "GERENTE"]);
if (actor instanceof NextResponse) return actor;

// Exigir permiso de acción
const actor = await requireCan("create"); // | "edit" | "delete" | ...
if (actor instanceof NextResponse) return actor;
```

Fuente: `src/lib/authz.ts`

---

## Patrón de auditoría (silencioso)

```ts
prisma.activityLog.create({
  data: { userId: actor.id, action: "CREATE", module: "tienda", recordId: id, details: "..." }
}).catch(() => {}); // No romper el flujo si falla
```

---

## Patrón de notificaciones

```ts
await prisma.notificacion.createMany({
  data: destinatarios.map((u) => ({
    userId: u.id,
    titulo: "Título",
    descripcion: "Descripción...",
    tipo: "INTEGRACION", // | "TIENDA" | "ASIGNACION" | etc.
    enlace: "/dashboard/integracion",
  })),
});
```

---

## Endpoints por módulo

### Tienda
| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| GET | `/api/tienda` | Lista paginada con filtros | `requireAuth` + canSeeModule("tienda") |
| POST | `/api/tienda` | Crear despacho | `requireCan("create")` |
| GET | `/api/tienda/[id]` | Detalle con plines e historial | `requireAuth` |
| PUT | `/api/tienda/[id]` | Cambiar estado / editar | `requireAuth` + validación por rol |
| GET | `/api/transporte/pendientes-tienda` | Guardados pendientes de tienda | SUPERVISOR_TRANSPORTE |
| POST | `/api/tienda/[id]/guardado` | Guardar despacho en CEDI | SUPERVISOR_TRANSPORTE |

### Transporte
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/transporte` | Lista guardados |
| POST | `/api/transporte` | Crear guardado |
| PUT | `/api/transporte/[clientId]` | Editar guardado |
| POST | `/api/transporte/[clientId]/acciones` | Despachar / otras acciones |
| GET/POST | `/api/transporte/[clientId]/contactos` | Contactos del cliente |
| GET | `/api/transporte/sin-contacto` | Guardados sin contacto |

### Solicitudes de Transporte
| Metodo | Ruta | Descripcion | Auth |
|---|---|---|---|
| GET | `/api/solicitudes-transporte` | Lista solicitudes no eliminadas con filtros por estado, prioridad, semaforo, area y busqueda; incluye PLUs | Todos excepto TRANSPORTISTA; no gestores ven solo propias |
| POST | `/api/solicitudes-transporte` | Crear solicitud interna; exige cantidad cajas, flete si/no y minimo 1 PLU | Todos excepto TRANSPORTISTA |
| GET | `/api/solicitudes-transporte/[id]` | Detalle completo con historial y PLUs | Creador o SUPERVISOR_TRANSPORTE/GERENTE/ADMIN |
| PATCH | `/api/solicitudes-transporte/[id]` | Editar datos de solicitud o gestion transporte; ADMIN/GERENTE pueden editar cualquier solicitud no eliminada | Creador en pendiente/rechazada; gestion solo SUPERVISOR_TRANSPORTE/GERENTE/ADMIN |
| DELETE | `/api/solicitudes-transporte/[id]` | Borrado logico con `deletedAt`, `deletedById` y `deleteReason` | ADMIN/GERENTE |
| POST | `/api/solicitudes-transporte/[id]/rechazar` | Rechazar con motivo obligatorio | SUPERVISOR_TRANSPORTE/GERENTE/ADMIN |
| POST | `/api/solicitudes-transporte/[id]/reenviar` | Reenviar solicitud rechazada | Creador o gestor |
| GET | `/api/solicitudes-transporte/catalogos` | Areas, ciudades, puntos de recogida, transportadoras y opciones del formulario | Todos excepto TRANSPORTISTA |

### Exportaciones
| Metodo | Ruta | Descripcion | Auth |
|---|---|---|---|
| GET | `/api/exportaciones` | Lista registros no eliminados con filtros por fecha, usuario, caja, PLU y estado | ETIQUETADO ve propios; SUPERVISOR_ALMACENAMIENTO/GERENTE/ADMIN ven todos |
| POST | `/api/exportaciones` | Crea captura con caja, PLU y unidad; autocompleta descripcion desde maestro y cierra el registro anterior abierto del usuario | ETIQUETADO, SUPERVISOR_ALMACENAMIENTO, GERENTE, ADMIN |
| PATCH | `/api/exportaciones/[id]` | Corrige caja, PLU, unidad y horas; cambiar horas exige motivo | SUPERVISOR_ALMACENAMIENTO, GERENTE, ADMIN |
| DELETE | `/api/exportaciones/[id]` | Borrado logico auditado | SUPERVISOR_ALMACENAMIENTO, GERENTE, ADMIN |

### Indicadores CEDI
| Metodo | Ruta | Descripcion | Auth |
|---|---|---|---|
| GET | `/api/indicadores` | Lista indicadores cacheados desde PostgreSQL con filtros por proceso, periodo, fuente y busqueda | Roles con acceso al modulo `indicadores` |
| POST | `/api/indicadores/sync` | Sincronizacion manual desde Google Sheets hacia PostgreSQL | ADMIN, GERENTE |
| GET/POST | `/api/cron/indicadores-sync` | Sincronizacion automatica para Vercel Cron | Header `Authorization: Bearer <secret>` o `x-cron-secret` |

### Integración de Pedidos
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/integracion` | Lista paginada con filtros (estado, area, tipo, fecha) |
| POST | `/api/integracion` | Crear integración (con detección de duplicados) |
| GET | `/api/integracion/[id]` | Detalle con plines agrupados |
| PUT | `/api/integracion/[id]` | Completar Área 2 o Marcar Completada |
| DELETE | `/api/integracion/[id]` | Eliminar (solo ADMIN) |

### Preoperacional
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/preoperacional` | Inspecciones del conductor |
| POST | `/api/preoperacional` | Crear inspección |
| GET | `/api/preoperacional/[id]` | Detalle completo con items (ADMIN/GERENTE/SUPERVISOR_TRANSPORTE) |
| DELETE | `/api/preoperacional/[id]` | Eliminar inspección (solo ADMIN) |
| GET | `/api/preoperacional/historial` | Historial del conductor |
| GET | `/api/preoperacional/export` | Exportar a Excel |

### Novedades (Inventario)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/novedades` | Lista con filtros |
| POST | `/api/novedades` | Crear novedad |
| PUT | `/api/novedades/[id]` | Editar / cambiar estado |
| DELETE | `/api/novedades/[id]` | Eliminar (solo ADMIN) |
| GET | `/api/novedades/stats` | Estadísticas |

### Usuarios
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/users` | Lista todos (ADMIN) o filtrar por rol |
| POST | `/api/users` | Crear usuario (ADMIN) |
| PUT | `/api/users/[id]` | Editar usuario (ADMIN) |
| GET | `/api/users/vehiculos` | Vehículos operativos |
| GET | `/api/users/transportistas-operativos` | Conductores activos |
| GET | `/api/users/transportistas-disponibles` | Sin usuario asignado |

### Conteo
| Ruta | Descripción |
|---|---|
| `/api/conteo/ciclos` | CRUD ciclos de conteo |
| `/api/conteo/ciclos/[id]/asignar` | Asignar operarios |
| `/api/conteo/ciclos/[id]/calcular` | Calcular diferencias |
| `/api/conteo/ciclos/[id]/importar` | Importar teorico desde `.xlsx` o `.csv` con limite de tamano/filas |
| `/api/conteo/ciclos/[id]/reporte` | Exportar reporte |
| `/api/conteo/lineas` | Gestión de líneas |
| `/api/conteo/operarios` | Operarios del ciclo |

### Otros
| Ruta | Descripción |
|---|---|
| `/api/notificaciones` | GET/POST notificaciones del usuario |
| `/api/notificaciones/leer` | Marcar como leídas |
| `/api/activity` | Log de actividad (paginado) |
| `/api/stats` | Estadísticas globales |
| `/api/indicadores` | Indicadores CEDI cacheados desde Google Sheets |
| `/api/productos-maestro/[plu]` | Búsqueda de PLU en catálogo |
| `/api/productos-maestro/importar` | Importar CSV/Excel de productos |
| `/api/uploads/foto` | Upload de imágenes |
| `/api/mis-tareas` | Tareas pendientes del usuario |

---

## Notas de seguridad de archivos

- `/api/productos-maestro/importar` acepta solo `.xlsx`, con limite de tamano y filas.
- `/api/conteo/ciclos/[id]/importar` acepta `.xlsx` y `.csv`, con limite de tamano y filas.
- `/api/uploads/foto` acepta solo JPG, PNG o WebP, maximo 5 MB. SVG queda rechazado.
- `/api/stats` esta restringido a `ADMIN` y `GERENTE`.
- Google Sheets se consume solo desde backend con service account y variables de entorno; ningun secreto se expone al cliente.
