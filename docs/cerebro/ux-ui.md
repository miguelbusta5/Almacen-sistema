# UX / UI - Control Logistico CEDI

> Links: [[00-master-context]] - [[modulos]] - [[decisiones]]

---

## Direccion vigente 2026-06-18: Colorido Neon Enterprise con assets

- La interfaz adopta una identidad **Colorido Neon Enterprise**: base premium navy/neon, modulos con color propio, estados operativos con color semantico real y encabezados con renders 3D.
- Se abandona la restriccion **Claro Ejecutivo Azul/Gris**. El azul sigue siendo importante, pero ya no limita toda la interfaz.
- La app debe sentirse cercana a una herramienta enterprise tipo Vercel/Linear/Supabase/Notion, pero con identidad CEDI: viva, densa, funcional y escalable.
- El color debe tener funcion: modulo, estado, prioridad, foco o accion. No usar decoracion gratuita.
- Los encabezados de modulo deben usar `ModuleHero` o clases compatibles con variables de `moduleTheme`; cada modulo define `heroImage`, `heroGradient`, `glow` y `surface`.
- Los assets visuales versionados viven en `public/ui/module-heroes/`; nunca se referencian desde `.codex`.
- Logistica, rutas, GPS y Mi Ruta siguen suspendidos indefinidamente.

## Referencias aprobadas

- Claro: `C:\Users\USUARIO\.codex\generated_images\019e979a-7c0c-74d3-8494-63a1cbf080a6\ig_0d5909cbba99bf9e016a33ea9eb9cc81919bbc4dc1ac9d191d.png`
- Oscuro: `C:\Users\USUARIO\.codex\generated_images\019e979a-7c0c-74d3-8494-63a1cbf080a6\ig_0d5909cbba99bf9e016a33eb9b00488191af1ea9c41d3efa52.png`
- Neon con detalle: `C:\Users\USUARIO\.codex\generated_images\019e979a-7c0c-74d3-8494-63a1cbf080a6\ig_0988ec5b4e4ea755016a33f9e3f8d881918d437124ace42cbb.png`
- Facturas Contado patron modular: `C:\Users\USUARIO\.codex\generated_images\019e979a-7c0c-74d3-8494-63a1cbf080a6\ig_018dff774d8ac89f016a348d415dec819187bf6a366faf02b6.png`

## Fase modular 2026-06-19: Facturas Contado como patron

- El redisenio visual deja de hacerse sobre toda la app al tiempo. Cada modulo se corrige por separado hasta quedar estable.
- Facturas Contado (`/dashboard/tienda`) queda como primer modulo patron: hero dark/neon, KPI cards ejecutivas, pipeline de estados, inteligencia operacional, filtros compactos, tabla con rails de estado y drawer de detalle.
- La presentacion especifica del modulo vive en componentes locales y CSS module: `src/app/(dashboard)/dashboard/tienda/_components.tsx` y `src/app/(dashboard)/dashboard/tienda/tienda.module.css`.
- `page.tsx` conserva datos, permisos, handlers y reglas de negocio. No se cambian APIs, base de datos, rutas ni permisos.
- Los siguientes modulos deben copiar el patron por componentes locales primero, y solo promover piezas al design system cuando se repitan con claridad.


## Cierre estructural 2026-06-18

- `globals.css` queda como fuente consolidada: un `:root` para claro y un bloque `html[data-theme="dark"]` para oscuro. No agregar nuevas eras visuales al final del archivo.
- `ModuleHero` es el encabezado obligatorio para pantallas nuevas y para migraciones de pantallas principales. El asset del modulo debe renderizarse como elemento real controlado, no como pseudo-elemento que pueda tapar texto o acciones.
- Los headers legacy `.g-module-header`/`.op-module-header` solo quedan como compatibilidad temporal para pantallas secundarias; no deben usarse en nuevas pantallas.
- Facturas Contado, Solicitudes Transporte, Usuarios y Auditoria ya usan `ModuleHero` como parte del cierre de fidelidad neon.

## Principios visuales

- **Modulo-aware:** cada modulo define `color`, `tint`, `gradient`, `darkColor`, `darkTint` y contraste desde `src/lib/moduleTheme.ts`.
- **Hero con asset:** cada modulo define imagen/render lateral en `public/ui/module-heroes/` para evitar headers planos.
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
--module-hero-image
--module-hero-gradient
--module-glow
--module-surface
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
.module-hero
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
- 2026-06-18: se corrige la direccion hacia **Colorido Neon Enterprise con assets**, usando `ModuleHero`, renders por modulo, KPIs con glow y tablas con rails.
- 2026-06-18 (fix neon): el rediseno neon forzaba apariencia oscura con `!important` en `body`, cards, tablas, stats, status-band, slide-panel y detail-section **en ambos temas**, rompiendo el modo claro (todo salia navy) y dando exceso de glow. Correccion con criterio (sin agregar otra capa nueva):
  - `body` vuelve a ser **coherente por tema** (claro = `--canvas` claro con halo sutil de modulo; oscuro = navy neon). Sin `!important`.
  - Las superficies de contenido neon-oscuras se **acotan a `html[data-theme="dark"]`**; en claro caen a las superficies claras de la capa Colorido Enterprise.
  - **Glow controlado:** halos de KPI (`opacity .16`, 118px), hero (sombra/borde menos saturados, radiales mas suaves), titulo del hero a `clamp(26-34px)` peso 850.
  - **Asset 3D del hero:** de `cover` (recortaba/agrandaba) a `contain`, ancho `min(40%,400px)`, mascara para no tapar texto/acciones.
  - El `ModuleHero` sigue siendo banda neon oscura en ambos temas (intencional, como la referencia).
  - **Pendiente:** consolidar los tres bloques `:root` apilados en una sola fuente de verdad (riesgo medio, requiere migrar radii/tipografia/layout del primer `:root`).
  - **Exportaciones:** filtro de **productividad por operario** (cliente, sobre datos ya cargados) ademas del filtro por fecha existente; sin cambios de API.
  - **Exportaciones — KPI productividad acumulado:** el panel "Productividad por operario" tiene controles propios de **rango de dias** (Desde/Hasta + atajos Hoy/7/30 dias, default ultimos 7 dias), independientes del filtro de la lista; el endpoint `/api/exportaciones/stats` agrega el rango de forma **acumulada**.
