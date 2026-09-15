# Pausas de alimentación y cambio de baterías — 2026-09-14

Implementado en el código local. No se ha aplicado el cambio de base de datos ni publicado.

## Comportamiento

- Botones **Tiempo de alimentación** y **Cambio de baterías** en Control Montacargas,
  Resurtido, Recepción Contenedores y Montaje Resurtido (según visibilidad por rol).
- Una pausa personal a la vez. Afecta todos los movimientos, tareas de resurtido,
  pendientes independientes y planillas de recepción **propios y en curso**.
- En recepción, la planilla pertenece a quien la abrió. Pausar esa planilla detiene
  su ventana de descarga completa; no representa pausas individuales de descargadores.
- Los registros pendientes de empezar, cerrados, eliminados o en novedad no arrancan
  al reanudar. Se conservan estado operativo, cantidades, ubicaciones y responsables.
- Los tramos abiertos se cierran al pausar y se abre un nuevo tramo al continuar.
  Las horas originales permanecen intactas. El DTO informa `pausaId`, `pausaInicio`
  y `pausaSegundos`; los cronómetros y duraciones descuentan el tiempo pausado.
- Las tareas abiertas tienen los controles dentro del modal. La pausa oculta ese
  modal sin desmontarlo; al reanudar se recuperan los campos que estaban escritos.
  Los borradores no guardados no sobreviven una recarga completa, igual que antes.
- La pausa sí sobrevive recargas, navegación y cambio de dispositivo; se consulta
  desde el servidor cada 15 segundos con la pestaña visible y al volver a enfocarla.
- El historial conserva motivo, usuario, inicio, fin e IDs afectados. Hay auditoría
  de inicio y fin. No se crea una justificación de tiempos muertos de supervisión.

## Auditoría de superficies

| Superficie | Fuente y contrato | Validación y riesgo |
|---|---|---|
| Control Montacargas | `pages/control-montacargas.vue`, `components/montacargas/*`, `/api/montacargas`; cantidades/ubicación/estado de `MovimientoMontacargas`, tramos por usuario | `assertUsuarioMontacargas` y validaciones específicas existentes; tarjetas y Badge de tabla conservados. Riesgo: traspasos y sobrantes concurrentes. |
| Resurtido | `pages/resurtido.vue`, `components/resurtido/*`, `/api/resurtido-tareas`, `/api/pendientes`; tareas por responsable actual o dueño del montaje | `assertEjecutor` y ownership existentes. Riesgo: conservar borradores y no reiniciar tareas sin empezar. |
| Recepción | `pages/recepcion-contenedores.vue`, `components/recepcion/*`, `/api/recepcion-contenedores`; planilla de creador, inicio/fin, descargadores | `assertUsuarioRecepcion` y dueño/gestor existentes. Riesgo: descontar también el tiempo en KPI e indicadores. |
| Controles compartidos | `components/PausaOperativa.vue`, `composables/usePausaOperativa.ts`, `layouts/default.vue` | Visibilidad con `canSeeModule`, tokens y botones existentes; región identificada, botones bloqueados durante peticiones. |

## Persistencia y concurrencia

Los dos schemas Prisma incluyen `PausaOperativa`, con `activaUsuarioId` único
(null al finalizar), y tres campos de pausa en cada uno de los cuatro modelos.
No se cambian enums ni se crean migraciones Prisma.

Las escrituras de estos flujos usan `defineOperacionAlmacenHandler`: transacción
Prisma y bloqueo asesor de PostgreSQL compartido. Así se ordenan iniciar/finalizar,
crear, cerrar y traspasar incluso entre instancias de Vercel. `AsyncLocalStorage`
hace que helpers y callbacks de transacciones existentes usen la misma conexión;
fuera de estos handlers Prisma conserva su comportamiento habitual. El bloqueo
serializa esas escrituras, no las lecturas ni el resto de módulos. Transacciones
con timeout de 30 segundos revierten completas si falla una operación.

No se permite modificar registros pausados, trabajar durante la pausa propia ni
abrir un tramo para un receptor pausado (incluye devoluciones y sobrantes). El
cierre requiere el ID exacto de la pausa propia, evitando que un reintento antiguo
cierre una pausa posterior. No hay mecanismo de cierre de pausas ajenas.

## Validación realizada

- 15 pruebas nuevas de servicio, permisos/guardas, exclusión de tiempos,
  reanudación, reintentos, tramos y propagación de errores: todas pasan.
- Suite completa: 1.526 pasan, 2 fallan en `facturasTable.render.test.tsx`
  (`Creado en tienda` frente a `Pendiente recogida`), 26 pendientes. Fallos fuera
  de los archivos modificados para pausas.
- `prisma validate` correcto y clientes regenerados en raíz y Nuxt.
- Build de producción Nuxt correcto, con advertencias previas de autoimports.
- `npx tsc --noEmit` no pasa por instalación incompleta de `@types/leaflet`.
  Con tipos explícitos aparecen referencias antiguas a `SlidePanel` en páginas
  React de muebles, tienda y transporte, fuera del cambio.
- Nuxt señala errores de tipos previos en montaje-resurtido/importación y dos
  helpers de reportes de exportaciones. Las llamadas mutantes de Montacargas
  llevan respuesta explícita para evitar recursión de inferencia de rutas Nitro.
- QA con Playwright (Browser plugin no disponible), Chrome headless contra
  `http://127.0.0.1:3002/dashboard`, API simulada, 1440×1000 y 390×844: ambos motivos,
  cronómetro congelado, cantidad escrita conservada, pausa restaurada tras recarga,
  controles en los tres módulos operativos, sin errores de página ni desborde.
- No se probó contra datos reales ni se ejecutó `db push`, commit, push o despliegue.

## Activación pendiente

Resolver las validaciones generales antes de push, revisar el diff de schema
contra la base de destino y aplicar `npx prisma db push` **sin `--accept-data-loss`**.
Regenerar los clientes (`npx prisma generate` en raíz y Nuxt) y desplegar Nuxt con
el schema aplicado primero. No publicar el frontend/API nuevos contra la base
anterior: necesitan las columnas y la tabla nuevas. Validar con un operario real
crear → pausar → recargar → reanudar → cerrar y revisar tiempos e indicadores.
