# Flujo de Despachos

> Links: [[estados-despacho]] · [[reglas-negocio]] · [[roles-permisos]] · [[base-datos]]

---

## Flujo de vida — Factura Contado (módulo Tienda)

> **Nombre en UI:** "Facturas Contado". Nombre interno en código: `DespachoTienda`.

```
┌─────────────────────────────────────────────────────────────────┐
│ TIENDA / SUPERVISOR_TIENDA                                       │
│   Crea factura → estado: CREADO_TIENDA                          │
│   Agrega: cliente, documento, dirección, nota de entrega, PLUs  │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │◄──────────────────────────────────────┐
                        │    re-envío (RECHAZADO → CREADO_TIENDA)│
                        ▼                                        │
┌─────────────────────────────────────────────────────────────────┐
│ SUPERVISOR_TRANSPORTE / GERENTE / ADMIN                          │
│   Puede rechazar → estado: RECHAZADO                            │
│   Debe indicar motivo (mínimo 5 chars)                          │
│   → Notificación al creador; cajón visual en UI de tienda       │
└─────────────────────────────────────────────────────────────────┘

Si no rechaza, recoge la mercancía:
┌─────────────────────────────────────────────────────────────────┐
│ SUPERVISOR_TRANSPORTE                                            │
│   Recoge en tienda → estado: RECOGIDO_TIENDA                    │
│   (puede asignar a operario TRANSPORTE para gestionar)          │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ SUPERVISOR_TRANSPORTE                                            │
│   Mercancía llega al CEDI → estado: ENTREGADO_CEDI              │
│   (puede guardarlo en custodia → flujo Guardados)               │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ SUPERVISOR_TRANSPORTE                                            │
│   Enviado al cliente → estado: ENVIADO_CLIENTE                  │
└─────────────────────────────────────────────────────────────────┘

En cualquier etapa activa (CREADO → RECOGIDO → ENTREGADO):
  └─► CON_NOVEDAD — incidencia registrada, requiere revisión
```

---

## Archivos del módulo Tienda

| Archivo | Propósito |
|---|---|
| `src/app/(dashboard)/dashboard/tienda/page.tsx` | Página UI principal |
| `src/app/api/tienda/route.ts` | GET lista + POST crear |
| `src/app/api/tienda/[id]/route.ts` | GET detalle + PUT actualizar estado |
| `src/lib/tienda.ts` | Tipos, helpers, constantes (COLOR_TIENDA, etc.) |
| `src/lib/tiendaFlow.ts` | Máquina de estados — transiciones permitidas |

---

## Modelos de base de datos involucrados

```
DespachoTienda
  ├── PlinDespacho[]        (PLUs del despacho)
  ├── HistorialDespacho[]   (log de cambios de estado)
  └── GuardadoPendienteTienda?  (si se guarda en CEDI)
```

Ver `prisma/schema.prisma` para los campos completos.

---

## Flujo de Guardados en Transporte

Paralelo al despacho de tienda — para pedidos en custodia del almacén:

```
PENDIENTE DESPACHO
  └─► DESPACHADO
```

Modelo: `TransporteGuardado`
Archivos: `src/app/(dashboard)/dashboard/transporte/page.tsx`
API: `src/app/api/transporte/route.ts`

El operario `TRANSPORTE` ve los guardados pendientes que le asignen.
El `SUPERVISOR_TRANSPORTE` puede guardar un despacho de tienda → se crea un `GuardadoPendienteTienda`.

---

## Flujo de Integración de Pedidos (OVDM / TSDM)

Para órdenes que tienen PLUs de dos áreas distintas (Muebles y Gourmet):

```
ÁREA 1 (MUEBLES o GOURMET)
  Crea integración con sus PLUs → PENDIENTE_AREA2

ÁREA 2 (la contraria)
  Completa con sus PLUs → LISTA_TRANSPORTE

TRANSPORTE (SUPERVISOR_TRANSPORTE / TRANSPORTE)
  Confirma recepción física → COMPLETADA
```

**Regla de duplicados:** Si el área contraria intenta crear una integración con el mismo número de documento, el sistema la redirige automáticamente al modal de "Completar Área 2".

Archivos:
- `src/app/(dashboard)/dashboard/integracion/page.tsx`
- `src/app/api/integracion/route.ts`
- `src/app/api/integracion/[id]/route.ts`

---

## Flujo Preoperacional (Conductores)

```
TRANSPORTISTA
  Realiza inspección diaria del vehículo → InspeccionPreoperacional
  Estados: APROBADA | APROBADA_CON_OBSERVACIONES | BLOQUEADA
```

El conductor debe tener un vehículo asignado para poder acceder.
API: `src/app/api/preoperacional/`
