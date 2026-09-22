# Entrega operativa — 22 de septiembre de 2026

Funciones implementadas y comprobadas localmente. Esta actualización aún no se ha
publicado. Los cambios de base de datos son aditivos y ya están aplicados.

## Decisiones del archivo original confirmadas

Reguero entero, sin modificar los decimales del teórico original (PLU 12520 =
0,32 y 12521 = 0,62). No convertir cantidades a partir de la descripción.
Los productos exclusivos de hoja 2 quedan fuera del alcance de hoja 1.

El usuario autorizó excluir con aviso los 7 PLU con disponible cero y sin
teórico de hoja 2: 18681, 23147, 21097, 1858, 21510, 13521 y BONO100.
Corrección de la revisión anterior: seis sí tienen posición RETIRO; BONO100 no.
El aviso persistente muestra códigos, descripciones y ubicaciones a Carlos.
No generan tareas ni aparecen en el consolidado. Si existe alguna fila con
cantidad distinta de cero sin teórico, la carga sigue bloqueada, incluso cuando
filas positivas y negativas se compensan. No se inventa un teórico cero.
El archivo original carga 7.542 filas agrupadas y 2.106 ubicaciones RETIRO.
El campo de avisos se aplicó con db push sin pérdida de datos.
## Inventarios

Carlos Moreno gestiona cronogramas y versiones PVP, carga el teórico filtrado de
dos hojas, asigna RETIRO a Juan Alberto Jimenez / Keiner Blanco y lanza el conteo.
Los contadores escanean ubicación y código de barras, capturan cajas × empaque +
reguero sin recibir existencias esperadas. Varios PLU en una ubicación generan
aviso; ausentes se registran en cero; inesperados generan novedad. Cada captura
confirmada persiste en servidor; el formulario incompleto se recupera en el mismo
navegador. Pausas de alimentación y fin de turno quedan excluidas del tiempo.

Al terminar el inicial, Carlos asigna reconteos independientes a uno o ambos
operarios. Cada uno registra el teórico actual de esa ubicación en NetSuite y el
físico. Carlos elige el resultado y cierra el caso, incluso si persiste diferencia.
No se altera el teórico inicial. El Excel de cierre conserva cantidades iniciales
(físico RETIRO + disponible de los demás conceptos) frente a hoja 2, UPC y precio
del PVP vigente al cierre; agrega la hoja de verificaciones. Las capturas y
correcciones quedan auditadas. Saneo de pasillos y averías continúan aplazados.

## Muebles

Reasignar orden libera al primer operario para otra. Debe finalizar su PLU abierto
y no estar en pausa. El receptor necesita equipo del día y no puede tener otra
orden. La reasignación comparte el bloqueo transaccional de apertura, escaneo,
cierre y pausas. Los PLU previos conservan autor y tipo de equipo.

Indicadores compara Genie / Order Picker por órdenes, PLU distintos, unidades,
minutos efectivos y unidades/hora, solo con picking terminado y restando pausas.
Una orden compartida puede aportar a ambos equipos. El patinador ve la fecha real
en Entrega a Transporte → Ver entregadas; Historial Muebles también la muestra.

El 21 de septiembre se eliminó definitivamente `CONTADO-OVDM121515` y su línea,
con autorización expresa. Se verificó que no tenía pendientes vinculados y se
conservó `OVDM121515`, ya entregada a transporte. Script puntual con doble guarda
de ID/código: `scripts/eliminar-contado-ovdm121515.mjs`.

## Almacenamiento

En Ver tareas del montaje se muestra porcentaje cerrado por cada responsable,
participaciones de ayudantes y reparto de tareas pendientes a ayudantes. Cada
porcentaje usa el total de tareas del montaje como denominador. Las tareas en
curso mantienen el traspaso operativo existente.

El reloj desde creación se congela al parar el montaje y resta la duración
acumulada al reanudar, incluso si vuelve al mismo operario. No se reconstruyen
pausas históricas ya finalizadas que antes no quedaban almacenadas.

Joel sí tiene registros. La API real para septiembre 1–21 devolvió 90.926 segundos,
43 PLU y 4.217 unidades, turno día. En noche se excluía por el filtro. El selector
ahora lista las personas del rol con su turno; elegir una cambia al turno correcto
sin modificar las fechas. No se inventaron movimientos de resurtido para Joel.

## Stretch film

`/dashboard/stretch-film`: Eduardo Zurita y Felipe Ossa gestionan inventario en
rollos (entradas y ajustes con motivo), procesan o rechazan pedidos. Solo al
entregar se descuenta, con comprobación de stock y transacción bloqueada. La misma
solicitud no genera dos salidas. Viviana solicita para CEDI o tiendas y ve sus
pedidos. Se conservan movimientos, saldo, responsable y fecha.

`/dashboard/stretch-pedidos`: pantalla compartida sin cuenta personal. Eduardo o
Felipe generan código de activación de un solo uso, válido hasta 12 horas. La
pantalla pide nombre, área y rollos; solo permite solicitudes internas. Sesión en
cookie HttpOnly, tokens almacenados como hash, vencimiento y revocación. No expone
stock, historial ajeno ni acciones de gestión. Límite 60 solicitudes/hora/sesión.
El nombre digitado identifica al solicitante, no verifica identidad personal.

## Base de datos y validación

- Ambos esquemas y clientes Prisma sincronizados. `prisma db push` ejecutado sin
  `--accept-data-loss`, usando la conexión directa configurada.
- Permisos por ID concedidos a las cuentas exactas solicitadas. Carlos ya estaba
  reactivado por autorización del 18 de septiembre; no se reactivaron otras cuentas.
- RLS activada y accesos `anon`/`authenticated` revocados en las tablas nuevas:
  se utilizan exclusivamente desde el servidor Prisma.
- TypeScript raíz, servidor Nuxt y componentes Vue correctos; build Nuxt correcto.
- Suite final: 1.876 pruebas aprobadas, 26 TODO existentes y una prueba de base de
  datos omitida por defecto. Esta última se ejecutó separadamente y aprobó.
- Prueba real con rollback: inicial → pausa/reanudación → reconteos por ambos
  usuarios → elección de Carlos → cierre y relectura del Excel (UPC, cantidades,
  diferencia valorizada) → pedido y descuento único de rollos. No persistió QA.
- Navegador: captura ciega, recuperación del borrador, pausa, cero por ausencia,
  cierre de ubicación, entrega de rollos y solicitud compartida. API simulada,
  escritorio 1440×1000 y móvil 390×844, sin errores JS ni desborde horizontal.
- `scripts/configurar-modulos-septiembre.mjs --apply` aplica permisos y protección
  de tablas. No guarda conexiones ni secretos en archivos versionados.

Para publicación se deben desplegar ambos proyectos (Nuxt y Next). El rewrite de
`NUXT_PILOT_MONTACARGAS_URL` incorpora Inventarios, Stretch film y pantalla pública.
