# Decisiones de Arquitectura y Producto

> Links: [[pendientes]] · [[modulos]] · [[flujo-despachos]]

Registro cronológico de decisiones importantes. Una entrada por decisión, con fecha, contexto y consecuencias.

---

## 2026-06-10 — Suspensión de logística, rutas y GPS

**Decisión:**
- El módulo Logística queda **suspendido indefinidamente** como proyecto futuro
- Se eliminan rutas y asignación de rutas del flujo operativo actual
- El conductor (rol `TRANSPORTISTA`) queda limitado **únicamente** al módulo Preoperacional
- El flujo principal queda definido como: **Tienda → Supervisor Transporte → CEDI → Cliente**

**Contexto:**
- La implementación de GPS, rutas y asignación de conductores a rutas es demasiado compleja para la fase actual del proyecto
- El equipo necesita primero consolidar el flujo básico de despachos antes de añadir logística avanzada
- NetSuite ya maneja parte del tracking; duplicar esa funcionalidad no agrega valor inmediato

**Consecuencias:**
- Los modelos `Ruta`, `Parada`, `UbicacionGPS`, `IncidenciaRuta` permanecen en el schema pero sin API routes activas
- El CLAUDE.md y AGENTS.md incluyen la instrucción explícita de no reactivar logística
- El sidebar no muestra ningún ítem de logística/rutas

**Archivos afectados:** `src/components/common/Sidebar.tsx`, `src/lib/modulePermissions.ts`, `CLAUDE.md`

---

## 2026-06-09 — Implementación del módulo Integración de Pedidos

**Decisión:**
- Se crea un módulo nuevo para coordinar el picking de órdenes OVDM/TSDM entre dos áreas operativas
- Se añaden 2 nuevos roles: `OPERACIONES_MUEBLES` y `OPERACIONES_GOURMET`
- Color del módulo: violeta `#7C3AED` (distinto a todos los módulos existentes)
- Flujo de 3 estados: PENDIENTE_AREA2 → LISTA_TRANSPORTE → COMPLETADA

**Contexto:**
- Las órdenes OVDM/TSDM pueden contener PLUs de dos áreas distintas
- No existía forma de coordinar el picking entre áreas; el proceso era manual y sin visibilidad
- La detección de duplicados (mismo número de documento) redirige automáticamente al modal de completar

**Archivos nuevos:**
- `src/app/(dashboard)/dashboard/integracion/page.tsx`
- `src/app/api/integracion/route.ts`
- `src/app/api/integracion/[id]/route.ts`
- Modelos en `prisma/schema.prisma`: `IntegracionPedido`, `PlinIntegracion`, `EstadoIntegracion`

---

## 2026-06 — Sprint 8: Simplificación del flujo de tienda

**Decisión:**
- Se simplificó el flujo de despachos de tienda eliminando la asignación a rutas
- El supervisor de transporte gestiona directamente los estados sin pasar por logística
- Se mantiene la capacidad de asignar conductor + vehículo para los despachos

**Contexto:**
- La complejidad del flujo con rutas generaba fricción operativa
- El equipo de tienda necesitaba un flujo más directo y fácil de operar

---

## Plantilla para nuevas decisiones

```markdown
## YYYY-MM-DD — Título de la decisión

**Decisión:** Qué se decidió hacer (o no hacer).

**Contexto:** Por qué se tomó esta decisión.

**Consecuencias:** Qué cambió, qué archivos se afectaron.
```
