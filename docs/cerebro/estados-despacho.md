# Estados de Despacho

> Links: [[flujo-despachos]] · [[reglas-negocio]] · [[base-datos]] · [[pendientes]]

---

## Estados reales en la base de datos

Enum `EstadoDespacho` en `prisma/schema.prisma`:

| Valor | Descripción | Quién lo asigna |
|---|---|---|
| `CREADO_TIENDA` | Despacho registrado por tienda | TIENDA, SUPERVISOR_TIENDA |
| `RECOGIDO_TIENDA` | Supervisor transporte recogió en tienda | SUPERVISOR_TRANSPORTE |
| `ENTREGADO_CEDI` | Mercancía llegó al CEDI | SUPERVISOR_TRANSPORTE |
| `ENVIADO_CLIENTE` | Despacho enviado al cliente final | SUPERVISOR_TRANSPORTE |
| `CON_NOVEDAD` | Incidencia en cualquier etapa | SUPERVISOR_TRANSPORTE |

**Archivo fuente:** `prisma/schema.prisma` línea ~132
**Labels y colores en código:** `src/lib/tienda.ts` → `ESTADO_DESPACHO_LABEL` / `ESTADO_DESPACHO_COLOR`

---

## Transiciones permitidas

```
CREADO_TIENDA ──────────────────► RECOGIDO_TIENDA
                                        │
                                        ▼
                                 ENTREGADO_CEDI
                                        │
                                        ▼
                                 ENVIADO_CLIENTE

Desde cualquier estado: ──────► CON_NOVEDAD
```

Las transiciones válidas están definidas en `src/lib/tiendaFlow.ts`.

---

## Estados deseados (pendiente implementar)

> ⚠️ Los siguientes estados fueron solicitados pero **aún no están en la base de datos**. Ver [[pendientes]].

| Estado deseado | Descripción | Prioridad |
|---|---|---|
| `ENTREGADO` | Confirmación de entrega al cliente final | Media |
| `GUARDADO` | Despacho guardado en custodia del CEDI | Alta |
| `PENDIENTE_GUARDAR` | Marcado para guardar, aún no procesado | Alta |

**Para implementar:** Editar enum en `prisma/schema.prisma` → `npx prisma db push` → actualizar `tiendaFlow.ts` y `tienda.ts`.

---

## Estados de Integración de Pedidos

Enum `EstadoIntegracion` en `prisma/schema.prisma`:

| Valor | Descripción |
|---|---|
| `PENDIENTE_AREA2` | Área 1 creó la solicitud, espera a Área 2 |
| `LISTA_TRANSPORTE` | Área 2 completó, listo para transporte |
| `COMPLETADA` | Transporte confirmó recepción física |

---

## Estados de Inspección Preoperacional

Enum `EstadoInspeccion`:

| Valor | Descripción |
|---|---|
| `APROBADA` | Todos los ítems conformes |
| `APROBADA_CON_OBSERVACIONES` | Con notas pero puede operar |
| `BLOQUEADA` | Vehículo no apto para operar |

Enum `ResultadoInspeccion` (por ítem): `CONFORME` / `NO_CONFORME`

---

## Estados de Guardados en Transporte

Tipo string en modelo `TransporteGuardado`:

| Valor | Descripción |
|---|---|
| `PENDIENTE DESPACHO` | En custodia, por despachar |
| `DESPACHADO` | Ya fue entregado |
