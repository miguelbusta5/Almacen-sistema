# UX / UI - Control Logistico CEDI

> Links: [[00-master-context]] - [[modulos]] - [[decisiones]]

---

## Direccion vigente 2026-06-18: Colorido Completo Enterprise

- La interfaz adopta una identidad **Colorido Completo Enterprise**: base premium clara/oscura, modulos con color propio y estados operativos con color semantico real.
- Se abandona la restriccion **Claro Ejecutivo Azul/Gris**. El azul sigue siendo importante, pero ya no limita toda la interfaz.
- La app debe sentirse cercana a una herramienta enterprise tipo Vercel/Linear/Supabase/Notion, pero con identidad CEDI: viva, densa, funcional y escalable.
- El color debe tener funcion: modulo, estado, prioridad, foco o accion. No usar decoracion gratuita.
- Logistica, rutas, GPS y Mi Ruta siguen suspendidos indefinidamente.

## Referencias aprobadas

- Claro: `C:\Users\USUARIO\.codex\generated_images\019e979a-7c0c-74d3-8494-63a1cbf080a6\ig_0d5909cbba99bf9e016a33ea9eb9cc81919bbc4dc1ac9d191d.png`
- Oscuro: `C:\Users\USUARIO\.codex\generated_images\019e979a-7c0c-74d3-8494-63a1cbf080a6\ig_0d5909cbba99bf9e016a33eb9b00488191af1ea9c41d3efa52.png`

## Principios visuales

- **Modulo-aware:** cada modulo define `color`, `tint`, `gradient`, `darkColor`, `darkTint` y contraste desde `src/lib/moduleTheme.ts`.
- **State-aware:** los estados operativos no dependen del modulo; rechazado, pendiente, recogido, entregado, enviado, efectuado y bloqueado tienen senales propias.
- **Claro y oscuro nativos:** el modo oscuro usa superficies navy/graphite y colores luminosos; no es una inversion automatica del modo claro.
- **Jerarquia operativa:** encabezado de modulo, KPIs, tabs, filtros, tabla/lista, detalle y acciones deben leerse rapido.
- **Profundidad enterprise:** sombras, bordes, rails de estado y hover tintado deben dar vida sin perder densidad.
- **Mobile funcional:** en celular se prioriza captura, lectura compacta y acciones principales visibles.

## Tokens y clases vigentes

Definidos principalmente en `src/app/globals.css` y `src/lib/moduleTheme.ts`:

```css
--mod-color
--module-color
--mod-tint
--module-tint
--mod-gradient
--module-gradient
--state-success
--state-warning
--state-danger
--state-info
```

Clases de plataforma:

```css
.module-surface
.module-gradient
.state-rail
.colored-kpi
.detail-section
.status-tab
.ds-btn
.ds-card
.ds-panel
.ds-stat
.ds-table
.slide-panel
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
- No sacrificar velocidad de captura por decoracion.
- Mantener permisos con doble validacion: server + UI.
- Evitar nuevos estilos inline para color; preferir `moduleTheme`, `getModuleCssVars`, `Badge`, `Stat`, `DataTable` y `SlidePanel`.

## QA visual

Revisar en claro y oscuro, desktop, tablet y movil:

- Dashboard
- Facturas Contado
- Solicitudes Transporte
- Exportaciones
- Indicadores
- Preoperacional
- Integracion
- Conteo / Contar
- Centro de Control
- Mis Tareas
- Login

## Historial visual resumido

- 2026-06-11: identidad modular inicial y Control Logistico CEDI.
- 2026-06-16: Operativo Premium, luego Claro Ejecutivo Azul/Gris y CEDI Harmony.
- 2026-06-17: CEDI Clean Platform para componentes reutilizables.
- 2026-06-18: se adopta **Colorido Completo Enterprise** como direccion vigente y se abandona azul/gris como restriccion.
