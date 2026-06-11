# Estados de Despacho

> Links: [[flujo-despachos]] - [[reglas-negocio]] - [[base-datos]] - [[pendientes]]

---

## Estados reales en la base de datos

Enum `EstadoDespacho` en `prisma/schema.prisma`:

| Valor | Descripcion | Quien lo asigna |
|---|---|---|
| `CREADO_TIENDA` | Despacho registrado por tienda | TIENDA, SUPERVISOR_TIENDA |
| `RECHAZADO` | Transporte rechaza — espera correccion por tienda | SUPERVISOR_TRANSPORTE, GERENTE, ADMIN |
| `RECOGIDO_TIENDA` | Supervisor transporte recogio en tienda | SUPERVISOR_TRANSPORTE |
| `ENTREGADO_CEDI` | Mercancia llego al CEDI | SUPERVISOR_TRANSPORTE |
| `ENVIADO_CLIENTE` | Despacho enviado al cliente final | SUPERVISOR_TRANSPORTE |
| `CON_NOVEDAD` | Incidencia en cualquier etapa | SUPERVISOR_TRANSPORTE |

### Campos adicionales en RECHAZADO

- `motivoRechazo: String?` — texto obligatorio (mín. 5 chars) al rechazar; se limpia al re-enviar
- `rechazadoAt: DateTime?` — timestamp del rechazo; se limpia al re-enviar

**Archivo fuente:** `prisma/schema.prisma`
**Labels y colores en codigo:** `src/lib/tienda.ts` -> `ESTADO_DESPACHO_LABEL` / `ESTADO_DESPACHO_COLOR`

---

## Transiciones permitidas

```text
CREADO_TIENDA -> RECOGIDO_TIENDA -> ENTREGADO_CEDI -> ENVIADO_CLIENTE
       |               \                 \                 \
       |                \-----------------\-----------------> CON_NOVEDAD
       |
       +--> RECHAZADO --> CREADO_TIENDA  (ciclo de correccion)
```

Las transiciones validas estan definidas en `src/lib/tiendaFlow.ts`.

---

## Estados descartados

Los estados `ENTREGADO`, `GUARDADO`, `PENDIENTE_GUARDAR`, `EN_RUTA`, `ASIGNADO_RECOGIDA` y `ENTREGADO_CLIENTE` no hacen parte del flujo operativo actual. No agregarlos al enum ni reactivar rutas/logistica para soportarlos.

---

## Estados de Integracion de Pedidos

Enum `EstadoIntegracion` en `prisma/schema.prisma`:

| Valor | Descripcion |
|---|---|
| `PENDIENTE_AREA2` | Area 1 creo la solicitud, espera a Area 2 |
| `LISTA_TRANSPORTE` | Area 2 completo, listo para transporte |
| `COMPLETADA` | Transporte confirmo recepcion fisica |

---

## Estados de Inspeccion Preoperacional

Enum `EstadoInspeccion`:

| Valor | Descripcion |
|---|---|
| `APROBADA` | Todos los items conformes |
| `APROBADA_CON_OBSERVACIONES` | Con notas pero puede operar |
| `BLOQUEADA` | Vehiculo no apto para operar |

Enum `ResultadoInspeccion` por item: `CONFORME` / `NO_CONFORME`

---

## Estados de Guardados en Transporte

Tipo string en modelo `TransporteGuardado`:

| Valor | Descripcion |
|---|---|
| `PENDIENTE DESPACHO` | En custodia, por despachar |
| `DESPACHADO` | Ya fue entregado |
