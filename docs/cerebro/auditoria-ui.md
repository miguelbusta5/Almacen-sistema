# Auditoría UI — inconsistencias visuales entre módulos (EPIC A)

> Links: [[ux-ui]] · [[decisiones]] · [[pendientes]] · [[bugs]]
>
> **Fecha:** 2026-06-19 · **Alcance:** solo lectura. Cataloga diferencias contra la identidad
> **Dark Elegant (Obsidiana + Esmeralda)** ([[ux-ui]]). **No** se cambió UI todavía.
> Severidad: 🔴 alta · 🟡 media · 🟢 baja.

## Metodología

Se barrieron las páginas en `src/app/(dashboard)/dashboard/*` y los `src/lib/*` de color, buscando
desviaciones del sistema de diseño (`src/components/ui/*` + `globals.css`). Componentes canónicos:
`ModuleHero` (encabezado), `<Stat>`/`.ds-stat` (KPIs), `<DataTable>`/`.ds-table` (tablas),
`SlidePanel`+`DetailSection` (detalle), `Badge` + tokens `--state-*` (estados).

> ⚠️ **Módulos marcados 🗑️ se eliminan en EPIC D** (conteo, conteo/contar, studio, indicadores).
> **No migrar** su UI; se listan solo para completitud.

## Matriz de patrones por página

| Página | Encabezado | KPIs | Tabla | Detalle |
|---|---|---|---|---|
| dashboard (home) | `<h1>` inline ad-hoc | `<Stat>` ✓ | — | SlidePanel ✓ |
| inventario | `<h1>` + hero-gradient ad-hoc | propio | — (bottom-sheet móvil) | propio |
| tienda | `ModuleHero` ✓ | `.kpiCard` propio | `.facturaTable` propio | SlidePanel ✓ |
| transporte | `<h1>` ad-hoc | tarjetas/charts propias | `<table>` | SlidePanel ✓ |
| solicitudes-transporte | `ModuleHero` ✓ (+`<h1>` suelto) | hex propios | `.ds-table` ✓ | SlidePanel ✓ |
| exportaciones | `ModuleHero` ✓ (+`<h1>` suelto) | propio | `<table>` inline | Modal |
| integracion | `ModuleHero` ✓ | propio | `<table>` inline ×3 | SlidePanel ✓ |
| preoperacional | `ModuleHero` ✓ | `<Stat>` ✓ | `<table>` inline | SlidePanel ✓ |
| mis-tareas | `ModuleHero` ✓ | `<Seccion>` propio | — | — |
| usuarios | `ModuleHero` ✓ | — | `.g-table` + `<table>` inline | Modal |
| auditoria | `ModuleHero` ✓ | — | `.g-table` | Modal |
| muebles | `.g-module-header` **legacy** | charts propios | `<table>` | SlidePanel ✓ |
| centro-control | `<h1>` inline ad-hoc | tarjetas propias | — | propio |
| 🗑️ conteo / contar | `<h1>` ad-hoc | `<Kpi>` propio | `<table>` inline | — |
| 🗑️ indicadores | `cedi-hero` | hex propios | `.cedi-table` ×5 | — |
| 🗑️ studio | propio | propio | propio | propio |

---

## A1 — Encabezados

| Módulo | Tipo | Sev | Archivo:línea | Propuesta |
|---|---|---|---|---|
| muebles | ~~header legacy `g-module-header` con `--mod-color:#14DBA0`~~ | ✅ RESUELTO 2026-06-19 | `muebles/page.tsx` | A1: migrado a `<ModuleHero moduleKey="inventario">` con acciones. |
| dashboard (home) | Encabezados `<h1>` inline a medida (3 variantes de tamaño) | 🟡 | `dashboard/page.tsx:349,557,741` | Home no es módulo; aceptable, pero unificar tamaños vía token display. |
| inventario | Hero a medida: `<h1>` con `color:#F8FBFF` literal + panel `--module-hero-gradient` | 🟡 | `inventario/page.tsx:853,875` | Es mobile-first intencional; al menos `#F8FBFF`→`var(--text)`. Evaluar `ModuleHero compact`. |
| centro-control | `<h1>` inline ad-hoc en vez de `ModuleHero` | 🟡 | `centro-control/page.tsx:384` | Migrar a `ModuleHero`. |
| solicitudes / exportaciones | Tienen `ModuleHero` **y además** un `<h1>` suelto de sección | 🟢 | `solicitudes-transporte/page.tsx:556` · `exportaciones/page.tsx:287` | Verificar que sea subtítulo de sección, no segundo encabezado de módulo. |

## A2 — KPIs / Stats

| Módulo | Tipo | Sev | Archivo:línea | Propuesta |
|---|---|---|---|---|
| tienda | ~~KPIs con `.kpiCard` propio~~ | ✅ RESUELTO 2026-06-19→20 | `tienda/_components.tsx:49` | C2: migrado a `<Stat>` (DS enriquecido con prop `icon` + `.ds-stat-icon`); `.kpiCard*` eliminado. Ver [[decisiones]]. |
| varios | Cada módulo arma sus KPIs distinto: `<Stat>` (home, preoperacional), `<Kpi>` propio (🗑️conteo), tarjetas/charts a medida (centro-control, muebles, transporte), `<Seccion>` (mis-tareas) | 🟡 | `dashboard/page.tsx:358…`, `preoperacional/page.tsx:279-282`, `conteo/page.tsx:432`, `mis-tareas/page.tsx:164` | Estandarizar en `<Stat>` (tamaño/glow/tipografía). Mantener color por estado vía prop `color`. |
| referencia OK | `<Stat>` bien usado (color por token/estado) | ✅ | `dashboard/page.tsx`, `preoperacional/page.tsx` | Patrón a replicar. |

## A3 — Tablas

**Hallazgo central:** **ninguna** página usa el componente compartido `<DataTable>`. Coexisten **5
estilos** de tabla con densidades, rails y hover distintos.

| Estilo | Módulos | Sev | Archivo:línea | Propuesta |
|---|---|---|---|---|
| `.facturaTable` (módulo CSS propio) | tienda | 🔴 | `tienda/_components.tsx:370` | EPIC C: migrar a `<DataTable>` con `getRowColor` por estado, o alinear con `.ds-table`. |
| `<table>` inline (sin clase, `borderCollapse` a mano) | exportaciones, integracion, preoperacional, transporte, usuarios(2ª) | 🔴 | `exportaciones/page.tsx:372,510` · `integracion/page.tsx:326,589,713` · `preoperacional/page.tsx:566` · `usuarios/page.tsx:487` | Migrar a `<DataTable>`/`.ds-table`. |
| `.g-table` (legacy) | usuarios, auditoria | 🟡 | `usuarios/page.tsx:224` · `auditoria/page.tsx:209` | Unificar a `.ds-table`. Sort: hoy `<th>` con estilos inline y color activo literal (`#14DBA0`/`#5B9DFF`). |
| `.ds-table` ✓ | solicitudes-transporte | 🟢 | `solicitudes-transporte/page.tsx:609` | Patrón más cercano al DS; tomar como referencia. |
| `.cedi-table` 🗑️ | indicadores | — | `indicadores/page.tsx:118…` | No migrar (EPIC D). |

## A4 — Detalle / Drawer

| Módulo | Tipo | Sev | Archivo:línea | Propuesta |
|---|---|---|---|---|
| tienda, transporte, solicitudes, preoperacional, integracion, muebles, home | `SlidePanel`+`DetailSection`/`DetailGrid` ✓ | ✅ | — | Patrón consistente; mantener. |
| usuarios, auditoria, exportaciones | Detalle/edición vía `Modal` (no drawer) | 🟢 | — | Aceptable por naturaleza (CRUD/formulario), no forzar drawer. |
| centro-control, inventario | Detalle a medida (no SlidePanel ni Modal del DS) | 🟡 | `centro-control/page.tsx` · `inventario/page.tsx` | Evaluar `SlidePanel` para coherencia. |

## A5 — Espaciado / tipografía / botones / inline

| Tipo | Sev | Archivo:línea | Propuesta |
|---|---|---|---|
| ~~**Toast duplicado** ~6 veces~~ | ✅ RESUELTO 2026-06-19 | `tienda` · `transporte` · `muebles` · `preoperacional` (×2) | A5: `<Toast>` compartido en `src/components/ui`. Falta 🟡 `usuarios` (mismo bug `var(--text)`); `inventario` queda fuera (mobile-first). |
| ~~**Chip NetSuite** inline repetido~~ | ✅ RESUELTO 2026-06-19 | `tienda` · `transporte` · `muebles` | A5: `<NetSuiteChip>` con `var(--info)` + `color-mix`. |
| **Sort `<th>` inline** con color activo literal | 🟡 | `usuarios/page.tsx:227,231,234` · `auditoria/page.tsx:212,215` | Usar sort de `<DataTable>` o tokens. |
| Tamaños de fuente de `<h1>` fuera de token (`22/24/26/28/30`, `clamp` ad-hoc) | 🟢 | `centro-control/page.tsx:384` · `solicitudes-transporte/page.tsx:556` · `inventario/page.tsx:875` | Tokenizar tamaños display. |

## A6 — Estados / badges / colores hardcodeados

**Hallazgo central:** los estados se definen de **3 formas** distintas; ningún módulo usa los
tokens `--state-*`. Además hay paletas mezcladas (vieja vs nueva).

| Caso | Sev | Archivo:línea | Detalle / Propuesta |
|---|---|---|---|
| **Mapas de estado con hex VIEJO (fuera de paleta Dark Elegant)** | ✅ RESUELTO 2026-06-19 | `lib/tienda.ts` · `lib/transporte.ts` → tokens `var(--state-*)`; `lib/muebles.ts` → hex on-palette (Chart.js); `lib/sla.ts` ya tokenizado | Ver [[decisiones]] A6. Queda 🟡 tokenizar `muebles` (refactor color charts). |
| **Mapa de estado con hex NUEVO pero literal** (no token) | 🟡 | `solicitudes-transporte/page.tsx:90-103` (`#FFC53D/#34D9F0/#5B9DFF/#2EE6A6/#FF6B6B/#8B9398`) | Colores correctos, mecanismo incorrecto: reemplazar literales por `var(--state-*)`/`var(--warning)` etc. |
| **Acento esmeralda hardcodeado** `#14DBA0` como literal | 🟡 | `usuarios/page.tsx:227,231,234,424,431` · `mis-tareas/page.tsx:164` · `muebles/page.tsx:259` · varios charts | Usar `var(--accent)`. |
| **Grises/fallbacks fuera de token** (`#64748b`, `#94a3b8`, `#6b7280`, `#6B7280`, `#f97316`) | 🟡 | `usuarios/page.tsx:53-57` · `auditoria/page.tsx:30,225-226` · `centro-control/page.tsx:164` · `dashboard/page.tsx:49` · `conteo/page.tsx:432` | Usar `var(--muted)`/`var(--faint)`/`--state-*`. |
| ~~**`tienda.module.css` define `--factura-*` propios**~~ | ✅ RESUELTO 2026-06-19 | `tienda.module.css` | C6: `--factura-*` muertos eliminados; `--factura-cyan`→`var(--info)`. |

---

## Resumen priorizado

**🔴 Alta (rompe identidad Dark Elegant / coherencia):**
1. ~~Mapas de estado con hex viejo fuera de paleta → migrar a `--state-*`~~ ✅ **A6 resuelto** (2026-06-19): `tienda`/`transporte` con tokens, `muebles` con hex on-palette (Chart.js), `sla` ya estaba. Falta 🟡 tokenizar `muebles`.
2. Fragmentación de tablas (5 estilos, nadie usa `<DataTable>`) → converger a `.ds-table`/`<DataTable>`. Prioridad: tienda `.facturaTable` (EPIC C) y `<table>` inline.
3. ~~`muebles` con encabezado legacy `g-module-header` → `ModuleHero`~~ ✅ **A1 resuelto** (2026-06-19).

**🟡 Media (consistencia / mantenibilidad):**
4. KPIs no unificados (`.kpiCard`, `<Kpi>`, tarjetas a medida) → estandarizar en `<Stat>`.
5. ~~Toast y chip NetSuite duplicados inline → componentes compartidos~~ ✅ **A5 resuelto** (2026-06-19). Falta 🟡 toast de `usuarios`.
6. Encabezados ad-hoc en `home`/`inventario`/`centro-control`.
7. Colores correctos pero hardcodeados (esmeralda y paleta nueva como literales) → tokens.

**🟢 Baja:**
8. `<h1>` con tamaños fuera de token; `--factura-*` duplicados; grises/fallbacks sueltos.

**Dependencias:** A informa **EPIC C** (tienda: A2 `.kpiCard`, A3 `.facturaTable`, A6 `--factura-*`).
Los hallazgos en módulos 🗑️ (conteo/indicadores/studio) se resuelven por borrado en **EPIC D**, no por migración.
