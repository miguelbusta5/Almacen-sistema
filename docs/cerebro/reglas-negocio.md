# Reglas de Negocio

> Links: [[00-master-context]] · [[flujo-despachos]] · [[estados-despacho]] · [[roles-permisos]]

---

## Flujo principal

```
Tienda
  └─► Supervisor Transporte (recoge en tienda)
        └─► CEDI (mercancía llega)
              └─► Cliente (despacho final)
```

Cada etapa tiene un estado de despacho asociado. Ver [[estados-despacho]].

---

## Reglas por actor

> El módulo "Tienda" se llama **"Facturas Contado"** en la UI. El modelo en código sigue siendo `DespachoTienda` y la ruta `/dashboard/tienda`. Ver [[flujo-despachos]].

### Tienda (`TIENDA`, `SUPERVISOR_TIENDA`)
- Crea la factura contado con los datos del cliente
- Debe registrar en una nota los datos de dirección y entrega
- No puede avanzar el estado — solo crea
- Ve únicamente sus propios registros en curso
- **No puede editar** una factura en estado CREADO_TIENDA
- Si una factura es **rechazada** por transporte:
  - Ve el cajón de rechazadas con el motivo visible
  - Puede **editar** los datos mientras está en RECHAZADO (corregir PLUs, cliente, documento, etc.)
  - Puede **re-enviar** una vez corregido → vuelve a CREADO_TIENDA

### Supervisor de Transporte (`SUPERVISOR_TRANSPORTE`)
- Puede marcar la factura como:
  1. **Recogido en tienda** (RECOGIDO_TIENDA)
  2. **Llegó al CEDI** (ENTREGADO_CEDI)
  3. **Enviado al cliente** (ENVIADO_CLIENTE)
- Puede **rechazar** una factura (RECHAZADO) mientras está en CREADO_TIENDA — debe indicar motivo
  - El creador recibe notificación y ve la factura en un "cajón" prominente
  - El creador puede re-enviarla (vuelve a CREADO_TIENDA) después de corregirla
- Puede guardar una factura en custodia del almacén
- Puede asignar una factura a un operario de transporte
- Puede marcar facturas CON_NOVEDAD en cualquier etapa activa
- Gestiona Solicitudes de Transporte: completa Documento NetSuite, Stella, transportadora, guia, fecha de programacion y observacion; puede rechazar con motivo

### Operario de Transporte (`TRANSPORTE`)
- Ve los guardados y pendientes que le asignen
- No avanza estados de despacho de tienda directamente
- Puede gestionar los guardados en transporte
- Puede crear Solicitudes de Transporte como solicitante interno, pero no gestionarlas ni rechazarlas

### Conductor (`TRANSPORTISTA`)
- **Solo ve el módulo Preoperacional**
- Realiza la inspección diaria del vehículo con el checklist completo (58 ítems, 15 categorías)
- Categorías: LLANTAS, FRENOS, LUCES, ESPEJOS, CONDICIONES TECNICAS, APOYA CABEZA, CINTURONES DE SEGURIDAD, PLUMILLAS, PITO, LOGO, CARPA Y CABINA, PORTA ESCALERA, EQUIPO DE CARRETERA, EXTINTOR, DOCUMENTACION, ULTIMA FECHA DE MANTENIMIENTO, ALMACENAMIENTO Y TRANSPORTE
- 26 ítems marcados como críticos; si alguno es NO_CONFORME → estado BLOQUEADA
- Fuente del checklist: `src/lib/preoperacional.ts`
- Requiere tener un vehículo asignado para acceder
- No ve despachos, inventario ni nada más
- No ve Solicitudes de Transporte

### Inventario (`INVENTARIO`, `SUPERVISOR_INVENTARIO`)
- Solo accede a módulos de inventario y conteo
- No ve el módulo Facturas Contado

### Operaciones Muebles / Gourmet (`OPERACIONES_MUEBLES`, `OPERACIONES_GOURMET`)
- Solo ven el módulo Integración de Pedidos
- Coordinan picking de órdenes OVDM/TSDM entre áreas

---

## Módulo Logística / Rutas / GPS

> ⛔ **SUSPENDIDO** — Proyecto futuro. No reactivar.

- No hay asignación de rutas en el flujo actual
- No hay GPS ni tracking en tiempo real
- El módulo "Mi Ruta" está deshabilitado
- Ver [[decisiones]] para el registro de esta decisión

---

## Validación de permisos

**Regla crítica:** Siempre doble validación.

1. **Backend:** `requireCan(action)` o `requireRole([...roles])` en cada API route
2. **Frontend:** Ocultar botones/acciones con `canSeeModule(role, moduleKey)`

Nunca confiar solo en el cliente. Un usuario con acceso directo a la API no debe poder ejecutar acciones no permitidas.

**Archivos fuente:**
- `src/lib/authz.ts` — helpers de autenticación/autorización
- `src/lib/permissions.ts` — matriz de acciones por rol
- `src/lib/modulePermissions.ts` — visibilidad de módulos

---

## Reglas de datos

- Los PLUs vienen de NetSuite (sistema ERP de la empresa)
- Los documentos OVDM y TSDM son números de orden de NetSuite
- El campo `numeroDocumento` en despachos e integraciones es el ID de NetSuite
- No hay integración automática con NetSuite (por ahora se ingresan manualmente)

---

## Auditoría

Todo cambio relevante debe registrarse:
```ts
prisma.activityLog.create({
  data: { userId, action, module, recordId, details }
}).catch(() => {}); // falla silenciosamente — nunca romper el flujo
```

Módulo de auditoría visible para ADMIN y GERENTE.
