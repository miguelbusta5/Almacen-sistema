# Capacidad picking

Implementación solicitada el 2026-09-14. Publicado el 2026-09-15: tablas creadas con `prisma/migrate-capacidad-picking.sql` (aditivo, RLS activo) y permiso concedido a Bryan Torres, Felipe Ossa y Eduardo Zurita.

## Rutas y acceso

- `/dashboard/capacidad-picking`: informes con líneas, capacidades vigentes e historial. Permiso individual en `PickingAcceso`, concedido a cuentas existentes y activas; no se autoriza por nombre en cada petición.
- `/dashboard/montaje-resurtido`: pestaña **Por capacidad picking**, protegida por el permiso existente `puedeMontarResurtido` y el acceso de almacenamiento.
- Next reescribe la nueva ruta usando `NUXT_PILOT_MONTACARGAS_URL`, igual que el resto del CEDI.
- Menú Nuxt y React: búsqueda, grupos plegables, enlace activo y desplazamiento vertical. La visibilidad del enlace nuevo requiere rol admitido y permiso individual de `/api/me`.

## Informes y capacidades

`PickingInforme` registra autor, inicio, fin, revisión, pausas y líneas (`PickingLinea`). Un autor recupera su informe abierto; solo él puede modificarlo. Los tres usuarios autorizados pueden crear informes de corrección. Los informes finalizados son inmutables.

Cada línea contiene PLU, ubicación, cajas master y SENCILLO/DOBLE; doble profundidad no multiplica la capacidad. La UI guarda automáticamente las líneas completas y conserva un borrador local de los campos. El tiempo efectivo excluye alimentación y fin de turno; la pausa mantiene el informe abierto al siguiente turno.

Finalizar publica las líneas en `PickingCapacidad`, conserva los PLU no incluidos y rechaza ubicaciones ocupadas por otro PLU no incluido. El historial conserva los valores originales de cada informe. La revisión evita sobrescribir cambios de otra pantalla.

## Teórico y generación

`PickingTeorico` conserva archivo identificado por nombre, autor, fecha, filas normalizadas, validaciones y montaje generado. Importa primera hoja .xlsx, hasta 10 MB y 50.000 filas. Encabezados: Artículo, Número de depósito, Disponible, WMS Aisle. Solo RETIRO y ALMACENAMIENTO; existencias no negativas, incluidos decimales presentes en el archivo real. Suma duplicados por PLU/ubicación/concepto. Las cajas de capacidad y las solicitadas siempre son enteras.

Calcula `max(0, floor((cajasCapacidad * unidadesPorCaja - disponibleRetiro) / unidadesPorCaja))`. La conversión sale del maestro. Ausencia de retiro o de conversión queda para revisión.

Elige la altura con menor existencia que cubra la necesidad; si ninguna alcanza, combina alturas de menor a mayor y usa cajas completas. Reporta el faltante cuando la reserva no alcanza. Un doble picking se suspende como **Pendiente por validar** hasta confirmar la ubicación registrada. Guarda persona y fecha de validación; otra carga requiere nueva validación.

La confirmación recalcula dentro de la misma transacción y bloqueo PostgreSQL `71420914` usado por operaciones de almacén. Rechaza vistas previas desactualizadas, cargas ya utilizadas y PLU con tareas o pendientes abiertos. El montaje manual también verifica este bloqueo, pero solo contra tareas de resurtido abiertas: los pendientes de gourmet no lo bloquean, porque un pendiente cuyo PLU viene en el resurtido se suma a esa tarea. En el cálculo por capacidad bloquean solo los pendientes vivos (solicitado, asignado o en curso). Una generación reutiliza `MontajeResurtido` y `TareaResurtido` con sus estados, tiempos y pausas existentes.

## Activación

1. Configurar `DATABASE_URL` en el entorno local autorizado (no versionar credenciales).
2. `npx prisma db push`, sin `--accept-data-loss`. Si detecta pérdida de datos, detenerse y revisar el drift.
3. `npx prisma generate` en raíz y en `nuxt-app`.
4. `node scripts/habilitar-capacidad-picking.mjs` verifica que exista una sola cuenta activa para cada nombre: Bryan Torres, Felipe Ossa y Eduardo Zurita. Con `--apply` concede el permiso a esas identidades; nunca crea usuarios ni modifica contraseñas.
5. Ejecutar pruebas, comprobar los tipos/build y desplegar los proyectos según el flujo del SOT.

El intento local de `db push` no pudo ejecutarse porque falta `DATABASE_URL`. Vercel permite autenticación pero descarga esa variable como `[SENSITIVE]`; no constituye una conexión utilizable. No se han aplicado tablas ni permisos en producción.

## Validación

- Pruebas de cálculo: Excel, duplicados, redondeo, doble profundidad, selección/combinación de alturas, reserva insuficiente, ausencia de retiro/conversión y bloqueos.
- Pruebas de handlers: permisos, recuperación, revisiones, pausas entre turnos, publicación acumulada, conflicto de ubicación y confirmaciones serializadas.
- Suite completa: 1.647 pruebas aprobadas, 26 pendientes preexistentes.
- Importador ejecutado con el Excel real: 5.333 filas originales, 5.331 agregadas, 11 PLU con doble picking y 2 filas con existencias decimales.
- Build Nuxt de producción aprobado. QA mediante Playwright/Chrome local y API simulada: captura, recuperación tras recarga, pausa por turno, buscador, grupos plegables, validación de doble picking y confirmación de resurtido. Escritorio 1440×1000 y móvil 390×844; sin errores JavaScript. Browser plugin no disponible; se utilizó Playwright con Chrome instalado.
- Los assets del build aislado se sirven al navegador desde su carpeta de salida durante QA, reproduciendo el prefijo de Vercel. El servidor dev previo estaba en error y el build normal conservaba archivos de distintas versiones; se utilizó `.nuxt-picking-qa` / `.output-picking-qa`, ignorados por Git.
- TypeScript raíz aprobado al excluir únicamente las copias ajenas `*-CD-D-ADMIN15*` en una comprobación temporal, sin modificar `tsconfig.json`.
- TypeScript de Nuxt tiene dos errores preexistentes en reportes de exportaciones; el chequeo raíz encuentra copias ajenas `*-CD-D-ADMIN15*`. No borrar esas copias para hacer pasar el chequeo.
