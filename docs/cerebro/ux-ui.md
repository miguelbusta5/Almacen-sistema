# UX / UI - Control Logistico CEDI

> Links: [[00-master-context]] - [[modulos]] - [[decisiones]]

---

## Direccion vigente 2026-06-16: Claro Ejecutivo Azul/Gris

- La interfaz adopta una identidad **claro ejecutivo**: blanco, grises frios y azul CEDI como acento principal.
- Se abandona la direccion visual **Operativo Premium** multicolor porque genero una experiencia demasiado cargada y aun generica.
- La app debe sentirse como herramienta interna profesional de Control Logistico CEDI: clara, rapida, densa y escalable.
- Los colores por modulo dejan de ser protagonistas. El azul identifica accion y navegacion; rojo, ambar y verde quedan solo para significado semantico.
- Logistica, rutas, GPS y Mi Ruta siguen suspendidos indefinidamente.

## Principios visuales

- **Paleta contenida:** azul, blanco y grises. No usar acentos naranja, violeta, verde o cian para diferenciar modulos.
- **Jerarquia operativa:** encabezado de modulo, filtros, KPIs, tabla/lista y acciones deben leerse rapido.
- **Profundidad sobria:** sombras bajas, bordes suaves y hover/press sutil en botones.
- **Iconografia consistente:** Lucide con tamano y trazo uniformes; iconos dentro de botones o contenedores simples.
- **Datos en vivo:** las bandejas deben actualizar datos en segundo plano sin recargar toda la pagina ni perder formularios.
- **Mobile funcional:** en celular se prioriza captura, lectura compacta y acciones claras.

## Tokens y clases vigentes

Definidos en `src/app/globals.css`:

```css
--bg
--surface
--surface2
--surface3
--brand
--brand-tint
--border
--text
--muted
--success
--warning
--error
```

Clases de plataforma:

```css
.op-shell
.op-module-header
.op-workbench
.op-panel
.op-record-card
.op-status-band
.op-table-wrap
.op-action
.ds-btn
.ds-card
.ds-panel
.ds-stat
```

## Datos en vivo

- Hook base: `src/hooks/useAutoRefresh.ts`.
- Indicador visual: `src/components/ui/AutoRefreshIndicator.tsx`.
- Intervalo recomendado: 60 segundos.
- Pausar cuando la pestana esta oculta, hay modal abierto, captura en curso o edicion sin guardar.
- No usar reload completo del navegador como comportamiento por defecto.

## Reglas no negociables

- No reactivar Logistica, rutas, GPS ni Mi Ruta.
- No convertir el dashboard en landing page.
- No introducir paletas multicolor por modulo.
- No sacrificar velocidad de captura por decoracion.
- Mantener permisos con doble validacion: server + UI.

## QA visual

Revisar en desktop, tablet y movil:

- Login
- Dashboard
- Exportaciones
- Solicitudes Transporte
- Usuarios
- Facturas Contado
- Inventario
- Conteo / Contar
- Guardados
- Preoperacional
- Integracion
- Auditoria
- Mis Tareas

## Revision predeploy Lovable/Base44 - 2026-06-16

- Lovable se uso como referencia visual, no como reemplazo del codigo Next.js.
- Proyecto de referencia: https://lovable.dev/projects/4d6b97cb-f3a2-4767-8980-571366817628
- La comparacion se enfoca en Login, Dashboard, Solicitudes Transporte, Exportaciones, Usuarios y Preoperacional.
- Base44 no expuso herramienta callable en esta sesion; se documenta como checklist comparativo: navegacion, densidad, jerarquia, estados, formularios, responsive y operacion por rol.
- Antes de deploy se pulieron rastros multicolor restantes en Integracion, Mis Tareas, Centro de Control y tokens globales.
- Integracion, Mis Tareas y Centro de Control ahora usan indicador consistente de datos en vivo.
