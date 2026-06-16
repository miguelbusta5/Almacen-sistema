# Roles y Permisos

> Links: [[00-master-context]] · [[reglas-negocio]] · [[modulos]]

**Archivos fuente de verdad:**
- `src/lib/permissions.ts` — acciones CRUD por rol
- `src/lib/modulePermissions.ts` — visibilidad de módulos
- `src/types/index.ts` — tipo `UserRole`
- `prisma/schema.prisma` — enum `Role`

---

## Roles del sistema (12 en total)

### Mapeo conceptual → técnico

| Nombre visible | Valor en DB (Role enum) | Descripción |
|---|---|---|
| Administrador | `ADMIN` | Acceso total + Usuarios + Auditoría |
| Gerente | `GERENTE` | Todo operativo + Centro de Control |
| Supervisor Inventario | `SUPERVISOR_INVENTARIO` | Inventario + Conteo + Centro de Control |
| Supervisor Transporte | `SUPERVISOR_TRANSPORTE` | Facturas Contado + Guardados + Centro de Control |
| Supervisor Tienda | `SUPERVISOR_TIENDA` | Tienda + Centro de Control |
| Operario Inventario | `INVENTARIO` | Solo Inventario + Conteo |
| Operario Transporte | `TRANSPORTE` | Solo Guardados |
| Operario Tienda | `TIENDA` | Solo Facturas Contado (módulo `tienda`) |
| Conductor | `TRANSPORTISTA` | **Solo Preoperacional** (requiere vehículo asignado) |
| Operador (legado) | `OPERADOR` | Inventario + Transporte (rol heredado) |
| Operaciones Muebles | `OPERACIONES_MUEBLES` | Solo Integración de Pedidos |
| Operaciones Gourmet | `OPERACIONES_GOURMET` | Solo Integración de Pedidos |

---

## Módulos visibles por rol

| Módulo | ADMIN | GERENTE | SUP_INV | SUP_TRA | SUP_TIE | INV | TRA | TIE | TRANSP | OPER | OP_MUE | OP_GOU |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| inventario | ✅ | ✅ | ✅ | — | — | ✅ | — | — | — | ✅ | — | — |
| transporte | ✅ | ✅ | — | ✅ | — | — | ✅ | — | — | ✅ | — | — |
| solicitudes-transporte | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ |
| tienda | ✅ | ✅ | — | ✅ | ✅ | — | — | ✅ | — | — | — | — |
| preoperacional | ✅ | ✅ | — | ✅ | — | — | — | — | ✅ | — | — | — |
| conteo | ✅ | ✅ | ✅ | — | — | ✅ | — | — | — | — | — | — |
| conteo-contar | ✅ | ✅ | ✅ | — | — | ✅ | — | — | — | ✅ | — | — |
| mis-tareas | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | — | — |
| usuarios | ✅ | — | — | — | — | — | — | — | — | — | — | — |
| auditoria | ✅ | ✅ | — | — | — | — | — | — | — | — | — | — |
| centro-control | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — | — | — | — | — |
| integracion | ✅ | ✅ | — | ✅ | — | — | ✅ | — | — | — | ✅ | ✅ |

---

## Acciones CRUD por rol

Definidas en `src/lib/permissions.ts`:

| Acción | Roles autorizados |
|---|---|
| `create` | OPERADOR, GERENTE, ADMIN, INVENTARIO, SUPERVISOR_INVENTARIO, TRANSPORTE, SUPERVISOR_TRANSPORTE, TIENDA, SUPERVISOR_TIENDA, OPERACIONES_MUEBLES, OPERACIONES_GOURMET |
| `edit` | GERENTE, ADMIN, SUPERVISOR_INVENTARIO, SUPERVISOR_TRANSPORTE |
| `delete` | ADMIN |
| `manageUsers` | ADMIN |
| `viewAudit` | ADMIN |
| `manageConteo` | ADMIN, SUPERVISOR_INVENTARIO |
| `manageLogistica` | *(vacío — suspendido)* |

---

## Notas especiales

- **TRANSPORTISTA** requiere tener un registro en la tabla `Transportista` con `vehiculoId` asignado para poder iniciar sesión correctamente
- **Solicitudes de Transporte** puede ser creado por todos los usuarios autenticados excepto `TRANSPORTISTA`; la gestion/rechazo queda en `SUPERVISOR_TRANSPORTE`, `GERENTE` y `ADMIN`
- En **Solicitudes de Transporte**, `ADMIN` y `GERENTE` pueden editar cualquier solicitud no eliminada y ejecutar borrado logico; los demas solicitantes solo editan sus propias solicitudes cuando el flujo lo permite
- En **Solicitudes de Transporte**, `TRANSPORTISTA` no ve el modulo ni puede crear, consultar, editar o borrar solicitudes
- **OPERADOR** es un rol legado — acceso general a inventario y transporte. No crear usuarios nuevos con este rol
- Los roles **OPERACIONES_MUEBLES** y **OPERACIONES_GOURMET** son los más recientes (Sprint 8, 2026-06-09)
- La gestión de vehículos y transportistas es exclusiva del ADMIN desde el módulo Usuarios

---

## Dónde se crean/editan los usuarios

`/dashboard/usuarios` — solo accesible para ADMIN.
API: `POST /api/users` y `PUT /api/users/[id]`
