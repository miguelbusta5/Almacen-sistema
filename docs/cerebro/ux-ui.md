# UX / UI - Control Logistico CEDI

> Links: [[00-master-context]] - [[modulos]] - [[decisiones]]

---

## Direccion vigente 2026-06-19: Dark Elegant (Obsidiana + Esmeralda)

- La interfaz adopta una identidad **Dark Elegant**: base casi negra neutra (obsidiana) con un **unico acento esmeralda** (vivo, con punto neon) reservado a accion, foco y estado activo.
- **Solo modo oscuro.** Se elimino el tema claro, el toggle (`ThemeToggle`) y el script de init de tema. `:root` es el tema oscuro; `<html data-theme="dark">` se fija como salvaguarda de selectores legacy.
- **Acento unico de marca:** los modulos ya **no** se diferencian por color. Se distinguen por icono, kicker y tipografia. `moduleTheme.ts` resuelve todos los modulos a esmeralda.
- **Los estados SI conservan color** y son diferenciados/vivos: creado (esmeralda), recogido (cian), CEDI (verde), enviado (azul), rechazado (rojo), alerta (ambar). Viven en los tokens `--state-*` y en las variantes de `Badge`/`DataTable` (rail por fila), no en el tema de modulo.
- **Sin imagenes en los encabezados.** Se elimino `heroImage` y el slot de asset; `ModuleHero` es puramente tipografico (kicker + titulo + descripcion + acciones + metricas, con rail/hairline esmeralda). Los assets de `public/ui/module-heroes/` ya no se referencian.
- **Tipografia:** `Inter` (UI) + `Sora` (display/titulos/logo) + mono (`JetBrains Mono`), cargadas por `<link>` en `layout.tsx`. Tokens `--sans`, `--display`/`--logo`, `--mono`.
- Estilo: superficies planas con **hairline** sutil, jerarquia por tipografia y espacio (no por cajas de color), glow esmeralda solo en foco/activo, micro-animaciones discretas.
- Logistica, rutas, GPS y Mi Ruta siguen suspendidos indefinidamente.

## Principios visuales

- **Acento unico:** un solo esmeralda en toda la app; diferenciacion por icono/copy, no por color de modulo.
- **State-aware:** los estados operativos tienen color propio y vivo, independiente del modulo.
- **Dark-only nativo:** superficies obsidiana (`--canvas #0A0C0E`, `--surface #121519`), texto claro, bordes `rgba(255,255,255,.08)`.
- **Sin imagenes en heros:** encabezados tipograficos; nada de renders 3D ni assets laterales.
- **Jerarquia operativa:** encabezado de modulo, KPIs, tabs, filtros, tabla/lista, detalle y acciones deben leerse rapido.
- **Mobile funcional:** en celular se prioriza captura, lectura compacta y acciones principales visibles.

## Paleta (tokens en `src/app/globals.css`)

```
--canvas/--bg #0A0C0E   --surface #121519   --surface2 #171B20   --surface3 #1E232A
--surface-elevated #161A1F   --surface-rail #08090B
--border rgba(255,255,255,.08)   --border-strong rgba(255,255,255,.16)
--text #ECEFF1   --muted2 #C2C8CE   --muted #8B9398   --faint #5C636A
--accent #14DBA0   --accent-bright #5BF5C7   --accent-deep #0E9C76
success #2EE6A6 · warning #FFC53D · error #FF6B6B · info(cian) #34D9F0
--state-created #14DBA0 · --state-picked #34D9F0 · --state-cedi #2EE6A6
--state-sent #5B9DFF · --state-rejected #FF6B6B · --state-alert #FFC53D
```

`--mod-color`/`--module-color`/`--mod-gradient` se mantienen por compatibilidad pero **siempre resuelven a esmeralda** (acento unico). Para color de fila/estado, pasar `--row-color`/`--stat-color`/`--flow-color` por elemento.

## Clases de plataforma vigentes

```
.module-hero  .ds-btn  .ds-card  .ds-panel  .ds-stat  .ds-table  .ds-badge*
.slide-panel  .detail-section  .status-tab  .colored-kpi  .g-nav-item  .g-modal*
```

Componentes React del DS: `ModuleHero`, `DataTable`, `Stat`, `Badge`, `Modal`/`ConfirmModal`,
`ModuleDetailView` (detalle), y los helpers de detalle `DetailSection`/`DetailGrid`/`MiniHistory`/
`IntelBanner` (en `src/components/ui/SlidePanel.tsx`).

## Patrón de detalle (2026-06-26)

- El detalle de un registro es una **vista a ancho completo que reemplaza al listado** dentro del
  módulo, vía el componente compartido **`ModuleDetailView`** (`src/components/ui/ModuleDetailView.tsx`):
  botón "Volver al listado" + header con título/badge/**barra de acciones** + cuerpo `g-panel`. Es
  scroll de página (sin `position:fixed`), igual en desktop y mobile.
- Aplica a los 7 módulos con detalle (cargue-gourmet, preoperacional, integración, solicitudes-transporte,
  transporte, tienda, muebles). Las acciones operativas van en el **header**; las secciones de datos usan
  `DetailSection`/`DetailGrid`/`MiniHistory`.
- El **overlay `SlidePanel`** (drawer lateral / bottom-sheet) quedó **retirado de las páginas** y sin uso;
  solo se conservan sus helpers. No reintroducir el overlay para detalle. Ver [[decisiones]] (2026-06-26).

## Datos en vivo

- Hook base: `src/hooks/useAutoRefresh.ts`. Indicador: `src/components/ui/AutoRefreshIndicator.tsx`.
- Intervalo recomendado: 60 s. Pausar con pestana oculta, modal abierto, captura o edicion sin guardar.
- No usar reload completo del navegador como comportamiento por defecto.

## Reglas no negociables

- No reactivar Logistica, rutas, GPS ni Mi Ruta.
- No convertir el dashboard en landing page.
- No sacrificar velocidad de captura por decoracion.
- Mantener permisos con doble validacion: server + UI.
- No reintroducir modo claro, color por modulo ni imagenes en encabezados.
- Evitar nuevos estilos inline para color; preferir tokens, `Badge`, `Stat`, `DataTable`, `ModuleDetailView` (detalle) y los helpers `DetailSection`/`DetailGrid`. El overlay `SlidePanel` queda deprecado/sin uso para detalle (ver "Patrón de detalle").

## QA visual

Revisar en **oscuro** (unico tema), desktop (1440px), tablet (768px) y movil (390px):

- Dashboard / Login / Facturas Contado / Solicitudes Transporte / Exportaciones / Cargue Gourmet
- Indicadores / Preoperacional / Integracion / Conteo / Contar / Centro de Control / Mis Tareas / Usuarios / Auditoria
- **Patrón de detalle (2026-06-26):** en los 7 módulos con `ModuleDetailView` verificar abrir detalle → vista a ancho completo, "Volver al listado", acciones en el header y responsive en los 3 breakpoints.

## Historial visual resumido

- 2026-06-11: identidad modular inicial y Control Logistico CEDI.
- 2026-06-16 / 17 / 18: iteraciones Operativo Premium → Claro Ejecutivo → CEDI Clean → Colorido Enterprise → Colorido Neon Enterprise con assets (claro+oscuro, color por modulo, heroes con render 3D).
- 2026-06-19: **reescritura total del frontend a Dark Elegant (Obsidiana + Esmeralda)**: solo modo oscuro, acento unico esmeralda, estados con color propio, encabezados sin imagenes, fuentes Inter+Sora. Se elimina el tema claro, `ThemeToggle`, el color por modulo y `heroImage`.
- 2026-06-26: **migración del detalle a `ModuleDetailView`** (vista a ancho completo que reemplaza al listado) en los 7 módulos; se retira el overlay `SlidePanel` (helpers conservados). Ver [[decisiones]].
