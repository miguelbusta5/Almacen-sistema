# UX / UI — Design System

> Links: [[00-master-context]] · [[modulos]]

---

## Paleta de colores

| Área | Color | Hex |
|---|---|---|
| Muebles / Inventario | Azul | `#2563EB` |
| Transporte / Conductores | Cian | `#0E7490` |
| Tienda | Ámbar | `#D97706` |
| Integración de Pedidos | Violeta | `#7C3AED` |
| Conteo / Inventario activo | Verde | `#16A34A` |
| Usuarios / Admin | Gris pizarra | `#475569` |
| Éxito | Verde semántico | `var(--success)` |
| Error | Rojo | `var(--error)` |
| Alerta | Ámbar | `var(--warning)` |

> Regla: Verde/Rojo/Ámbar **solo** para significado semántico. No decorativo.

---

## Tokens CSS (variables)

Definidos en `src/app/globals.css`:

```css
--bg          /* Fondo de página */
--surface     /* Tarjetas / panels */
--surface2    /* Inputs / fondos secundarios */
--text        /* Texto principal */
--muted       /* Texto secundario */
--muted2      /* Labels de inputs */
--faint       /* Texto muy tenue */
--brand       /* Color primario (#2563EB) */
--border      /* Bordes suaves */
--shadow-md / --shadow-xl  /* Sombras */
--ring        /* Focus ring */
--overlay     /* Fondo de modales */
--error / --error-tint
--warning / --warning-tint
--success
--sans        /* Fuente sans-serif */
--mono        /* Fuente monospace */
```

---

## Componentes del design system

Importados desde `@/components/ui`:

### `Badge`
```tsx
<Badge variant="success" label="Completada" />
// variants: "success" | "warning" | "error" | "info" | "default" | "muted"
```

### `SkeletonTable`
```tsx
<SkeletonTable rows={6} cols={5} />
// Loader animado que imita una tabla
```

### `EmptyState`
```tsx
<EmptyState
  icon={<Icon size={28} />}
  title="Sin registros"
  description="Descripción opcional"
  action={{ label: "Crear nuevo", onClick: () => {} }}
/>
```

### `Stat` / `SkeletonStat`
```tsx
<Stat label="Total" value={42} sub="este mes" color="#2563EB" />
```

### `SlidePanel` (de `@/components/ui/SlidePanel`)
```tsx
<SlidePanel
  open={!!selected}
  onClose={() => setSelected(null)}
  title="Título del panel"
  subtitle="Subtítulo opcional"
  badge={<Badge ... />}
  primaryAction={<button>Acción</button>}
>
  {/* Contenido */}
</SlidePanel>
```

### `DetailSection` + `DetailGrid`
```tsx
<DetailSection title="Información general">
  <DetailGrid items={[
    { label: "Campo", value: "Valor" },
  ]} />
</DetailSection>
```

### `TimelineItem`
Para historiales y líneas de tiempo.

### `MiniHistory`
```tsx
<MiniHistory items={[{ label: "Creado", meta: "por Juan", time: "10:30", color: "#2563EB" }]} />
```

---

## Patrón mobile

Hook `useIsMobile()` en `src/lib/useIsMobile.ts` (breakpoint: 768px):

```tsx
const isMobile = useIsMobile();

// Ejemplo: grid responsivo
gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr"
```

**No usar Tailwind breakpoints** — todo el responsive se hace con este hook via inline styles.

---

## Clases de utilidad CSS

```css
.ds-btn              /* Botón base */
.ds-btn-primary      /* Botón primario */
.ds-btn-ghost        /* Botón fantasma */
.ds-btn-lg / .ds-btn-sm  /* Tamaños */
.ds-badge            /* Badge base */
.ds-empty            /* EmptyState */
.dsrow               /* Fila de tabla con hover */
.animate-scale-in    /* Animación de entrada */
.animate-fade-in     /* Fade in */
.lift                /* Efecto hover elevación */
```

---

## Navegación (Sidebar)

`src/components/common/Sidebar.tsx`:
- Filtrado automático por `canSeeModule(role, moduleKey)`
- Mobile: drawer con overlay (toggle con botón hamburguesa fijo)
- Desktop: sidebar fijo 204px de ancho
- Fondo: `#0D0F14` (casi negro)
- Ítems activos con indicador azul izquierdo + texto blanco

---

## Logo

`src/components/common/Logo.tsx`:
- Fuente: `public/logo.png`
- Variantes: `variant="auto"` (adapta al tema) | `variant="dark"` (siempre blanco) | `variant="light"` (siempre color)
- Prop `tagline`: muestra "Centro de Operaciones" debajo

---

## Modales

Patrón con `createPortal`:
- Siempre montar en `document.body`
- Cerrar con `Escape` (useEffect keydown)
- Bloquear scroll del body mientras está abierto
- Animación: clase `.animate-scale-in`
- Fondo: `background: "var(--overlay)"` con `backdropFilter: "blur(4px)"`
