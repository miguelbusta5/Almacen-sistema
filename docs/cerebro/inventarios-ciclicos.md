# Inventarios: conteo cíclico Gourmet

## Estado al 2026-09-22

Etapas 1–4 implementadas en el árbol de trabajo; **actualización todavía sin publicar**.
Archivo original validado: reguero entero y siete exclusiones con aviso persistente para Carlos; detalle en `entrega-septiembre-2026.md`.
Tablas aplicadas con `prisma db push` sin aceptar pérdida de datos, usando la
conexión directa configurada. Clientes Prisma generados para Next y Nuxt.
Carlos Moreno reactivado con autorización expresa y permiso individual de gestión.

## Etapas acordadas

1. **Cronogramas y maestro PVP (implementada).** Carlos define nombre, inicio y
   duración; carga un maestro y puede actualizarlo. Cada carga es una versión
   completa, inmutable, con autor, fecha, archivo, hash, resumen y productos.
   Revisión previa, búsqueda por PLU/UPC/descripción e historial de versiones.
2. **Teórico y conteo inicial (implementada).** Teórico filtrado de dos hojas por
   cíclico. Asignar ubicaciones RETIRO a Juan Alberto Jimenez y Keiner Blanco.
   Escaneo de ubicación y código de barras, descripción, captura ciega de cajas
   master × unidad de empaque digitada + reguero. Ausencias en cero y productos
   inesperados como novedad. Alertar varios PLU por ubicación sin bloquear.
   Guardado, tiempos y pausas por alimentación/finalización de turno.
3. **Verificación de diferencias (implementada).** Carlos reasigna casos al mismo
   operario o al otro, o a ambos independientemente. Capturar teórico actualizado
   de NetSuite para la ubicación y físico sin alterar el archivo inicial.
   Carlos selecciona el resultado válido cuando difieran y puede cerrar novedades.
4. **Cierre automático (implementado).** Generar Excel con el formato recibido y
   hoja maestro inv. Por PLU: físico inicial RETIRO + Disponible inicial de
   ubicaciones no contadas (incluye etapas salientes, ninguno y sin clasificación),
   comparado con Teórico de hoja 2, sin sumarlo nuevamente. Reconteos se conservan
   aparte. Valorar con PVP y mostrar UPC real. Confiabilidad = PLU sin diferencia /
   PLU contados. Vincular cierre a una versión del maestro, sin alterar informes
   cerrados al actualizarlo. No se pide subir una plantilla de cierre al operar.

Saneo de pasillos y recolección de averías quedan fuera por instrucción del usuario.
El CEDI sigue operando durante el conteo.

## Contrato PVP (etapa 1)

Se usa la primera hoja, por encabezados (no posiciones):

| Encabezado recibido | Dato |
| --- | --- |
| Referencia Original | PLU |
| Nombre para mostrar | Descripción |
| Fabricante | Proveedor |
| Código UPC | Código de barras, texto |
| Precio unitario | Precio base |
| MARCAS | Marca |
| GRUPO | Línea |

La columna llamada Nombre del proveedor en este archivo NO contiene el proveedor;
el cruce anterior fue confirmado por el usuario. Este maestro no modifica
ProductoMaestro ni unidades de empaque de los otros módulos.

Se aceptan hasta 50.000 filas / 10 MB .xlsx. PLU repetidos idénticos se consolidan;
contradicciones se rechazan. Filas sin PLU se enumeran como exclusiones antes de
confirmar. Precio vacío permanece nulo, distinto de cero. Datos incompletos y UPC
compartidos se señalan para revisión. No se inventan conversiones UPC/PLU.
Ejemplo recibido: 19.389 productos, 28 sin UPC y una fila sin PLU (SERVICIO FRANQUICIA).

## Seguridad, almacenamiento y rutas

- Página `/dashboard/inventarios` en Nuxt; rewrite compartido del CEDI en Next.
- API `/dashboard/api/inventarios`, `/maestro` y `/guardar`.
- `InventarioAcceso` autoriza por ID. Usuario activo y rol compatible obligatorios,
  tanto servidor como menú/pantalla. No se conceden permisos por nombre al operar.
- `scripts/habilitar-inventarios.mjs`: verifica identidad inequívoca de Carlos;
  `--apply` concede acceso; `--reactivar` solo con autorización explícita.
- `InventarioCronograma`, `InventarioMaestroVersion`, `InventarioProductoPvp`.
- Importación atómica, bloqueo transaccional y revisión de número de versión;
  no se sobrescribe el maestro anterior. Identificador de solicitud evita duplicar
  un cronograma por reintento de la misma confirmación.
- Historial y auditoría de carga. La etapa 1 no permite borrar ni cerrar cronogramas;
  el cierre de cada cíclico ya está implementado con sus validaciones.

## Comprobaciones históricas de etapa 1 (18 de septiembre)

- Importador probado con el archivo PVP real (lectura, sin importación productiva).
- Almacenamiento real de los 19.389 productos verificado en una transacción
  revertida: UPC, proveedor y precio comprobados; ningún registro QA persistido.
- Compilación final Nuxt correcta. Suite general: 1.820 pruebas aprobadas antes de
  ampliar las pruebas de etapa 1; las 16 pruebas específicas finales aprobaron.
- Pruebas unitarias de conversión, fechas, duplicados, permisos del handler,
  revisión sin escritura, versión desactualizada, cronograma cerrado y auditoría.
- TypeScript raíz correcto. Comprobaciones Nuxt conservan dos errores preexistentes:
  `exportacionesReporteCalc.ts:216` y `exportacionesReporteWorkbook.ts:243`.
- QA local con Playwright (Browser plugin no disponible), escritorio 1440×1000 y
  móvil 390×844: crear → revisar exclusiones → confirmar → buscar → acceso denegado.
  API simulada para no crear registros de prueba en producción; sin errores JS ni
  desplazamiento horizontal. El servidor se prueba separadamente.

## Comprobación actual

Ver entrega-septiembre-2026.md: 1.876 pruebas generales aprobadas, integración real
con rollback aprobada y 27 pruebas específicas aprobadas tras ajustar lectura decimal.
TypeScript raíz, servidor Nuxt y Vue correctos. Los dos errores previos de
Exportaciones se corrigieron en ambos stacks manteniendo las pruebas de paridad.
Pendientes exclusivamente las decisiones del archivo original descritas arriba.
