# Registro de Bugs

> Links: [[pendientes]] · [[modulos]] · [[api-endpoints]]

---

## Bugs abiertos

*(Ninguno registrado aún)*

---

## Bugs resueltos

*(Ninguno registrado aún)*

---

## Plantilla para registrar un bug

Copiar y pegar en la sección correspondiente (abierto o resuelto):

```markdown
## [BUG-XXX] Título descriptivo del bug

- **Fecha detectado:** YYYY-MM-DD
- **Módulo:** tienda | transporte | integracion | preoperacional | inventario | usuarios | otro
- **Severidad:** 🔴 Alta | 🟡 Media | 🟢 Baja
- **Reportado por:** (nombre o rol)
- **Descripción:**
  Qué está fallando y en qué contexto.
- **Pasos para reproducir:**
  1. Ir a...
  2. Hacer clic en...
  3. Observar que...
- **Comportamiento esperado:**
  Lo que debería pasar.
- **Comportamiento actual:**
  Lo que está pasando.
- **Archivo(s) afectado(s):**
  - `src/app/api/...`
  - `src/app/(dashboard)/dashboard/...`
- **Posible causa:**
  (Si se identificó)
- **Estado:** 🔴 Abierto | 🟡 En progreso | ✅ Resuelto
- **Solución aplicada:**
  (Si se resolvió) Qué se cambió y en qué commit.
- **Fecha resolución:** YYYY-MM-DD
```

---

## Cómo reportar un bug en una conversación con Claude

Usar el prompt de corrección de bugs de [[prompts]]:

```
Lee docs/cerebro/bugs.md, el archivo docs/cerebro/[módulo afectado].md 
y el estado actual del código en [ruta del archivo].

El bug es:
- Módulo: [módulo]
- Descripción: [qué falla]
- Pasos para reproducir: [pasos]
- Comportamiento esperado: [qué debería pasar]

Primero diagnostica la causa raíz, luego propón la solución.
Valida con npx tsc --noEmit y npm test antes de hacer push.
```
