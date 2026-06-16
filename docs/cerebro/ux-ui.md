# UX / UI - Control Logístico CEDI

> Links: [[00-master-context]] · [[modulos]] · [[decisiones]]

---

## Dirección vigente 2026-06-16: Operativo Premium

- La interfaz adopta **Control Logístico CEDI** como identidad definitiva.
- Se abandona el lenguaje "Torre CEDI" como rumbo visual vigente.
- La app debe sentirse como consola interna de operación CEDI: densa, clara, con jerarquía, señales de estado y trazabilidad por rol.
- El rediseño no debe parecer landing page ni plantilla SaaS genérica.
- Logística, rutas, GPS y Mi Ruta siguen suspendidos indefinidamente.

## Principios visuales

- **Workbench operativo:** las páginas se organizan como superficies de trabajo, no como colecciones de cards flotantes.
- **Profundidad sobria:** usar sombras, bordes y bandas de estado para separar jerarquía; evitar orbes, fondos decorativos y hero marketing.
- **Módulos con señal propia:** cada módulo toma color desde `src/lib/moduleTheme.ts`.
- **Densidad profesional:** tablas, filtros y formularios deben seguir compactos para operación diaria.
- **Mobile funcional:** en celular se priorizan captura, tarjetas compactas y acciones claras.

## Tokens y clases v2

Definidos en `src/app/globals.css`:

```css
--bg
--surface
--surface2
--surface3
--surface-command
--surface-rail
--brand
--module-inventario
--module-transporte
--module-tienda
--module-integracion
--module-conteo
--module-admin
```

Clases de plataforma:

```css
.op-shell
.op-workbench
.op-module-header
.op-module-kicker
.op-module-title
.op-module-copy
.op-panel
.op-record-card
.op-status-band
.op-metric-strip
.op-kpi
.op-table-wrap
.op-command-surface
.op-action
```

## Componentes y uso

- `src/components/common/Sidebar.tsx`: navegación por rol con identidad Control CEDI y `canSeeModule`.
- `src/components/common/Header.tsx`: contexto operativo, rol, alcance visible, notificaciones y comando.
- `src/components/control-logistico/index.tsx`: hero operativo, señales de módulo, prioridades y acciones recomendadas.
- `src/components/ui`: componentes base como `Badge`, `Stat`, `EmptyState`, `SkeletonTable`, `SlidePanel`.

## Módulos priorizados en rediseño

- **Login:** portal interno CEDI con marca, módulos y acceso corporativo.
- **Dashboard:** consola Control Logístico CEDI con prioridades, KPIs y flujo por rol.
- **Exportaciones:** captura de etiquetado con estado en curso, tabla de gestión y PLU maestro.
- **Solicitudes Transporte:** bandeja operativa con prioridad, semáforo, detalle y gestión.
- **Usuarios:** administración de cuentas, maestro PLU, vehículos y transportistas operativos.

## Reglas no negociables

- No reactivar Logística, rutas, GPS ni Mi Ruta.
- No crear estética de marketing dentro del dashboard.
- No duplicar colores de módulo fuera de `moduleTheme`.
- No sacrificar velocidad de captura por decoración.
- Mantener permisos con doble validación: server + UI.

## QA visual

Revisar en desktop, tablet y móvil:

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
- Integración
- Auditoría
- Mis Tareas
