# Prompts de Trabajo

> Prompts listos para copiar y usar al inicio de cualquier conversación con Claude Code.
> Links: [[00-master-context]] · [[pendientes]] · [[bugs]]

---

## 1. Revisar el estado del proyecto

Para entender el estado actual antes de empezar a trabajar:

```
Lee los siguientes archivos del cerebro del proyecto:
- docs/cerebro/00-master-context.md
- docs/cerebro/pendientes.md
- docs/cerebro/decisiones.md

Luego dame un resumen de:
1. Qué módulos están activos y cuáles suspendidos
2. Qué tareas están pendientes (ordenadas por prioridad)
3. Alguna decisión técnica reciente que deba tener en cuenta
4. Estado general del proyecto
```

---

## 2. Implementar nueva funcionalidad

Para agregar una característica nueva de forma segura:

```
Antes de escribir cualquier código, lee estos archivos:
- docs/cerebro/00-master-context.md
- docs/cerebro/reglas-negocio.md
- docs/cerebro/roles-permisos.md
- docs/cerebro/flujo-despachos.md
- docs/cerebro/decisiones.md
- docs/cerebro/pendientes.md

La funcionalidad que quiero implementar es:
[DESCRIPCIÓN DE LO QUE QUIERES HACER]

Antes de implementar:
1. Propón un plan con los archivos a modificar
2. Indica si hay patrones existentes que pueda reutilizar
3. Valida que no rompe las reglas de negocio actuales
4. Después de implementar: npx tsc --noEmit + npm test + git push origin master
```

---

## 3. Corregir un bug

Para diagnosticar y corregir errores:

```
Lee los siguientes archivos para entender el contexto:
- docs/cerebro/bugs.md
- docs/cerebro/[módulo afectado].md  ← reemplazar con el módulo correcto
- docs/cerebro/reglas-negocio.md

El bug que necesito corregir es:
- Módulo: [MÓDULO]
- Descripción: [QUÉ FALLA]
- Pasos para reproducir: [PASOS]
- Comportamiento esperado: [QUÉ DEBERÍA PASAR]
- Comportamiento actual: [QUÉ ESTÁ PASANDO]

Por favor:
1. Primero diagnostica la causa raíz sin modificar código
2. Propón la solución
3. Implementa con el mínimo cambio necesario
4. Valida con npx tsc --noEmit y npm test
5. Registra el bug resuelto en docs/cerebro/bugs.md
```

---

## 4. Actualizar documentación del cerebro

Para mantener el cerebro sincronizado con el código:

```
El sistema ha cambiado. Necesito actualizar el cerebro del proyecto.

Cambios realizados:
[DESCRIPCIÓN DE LO QUE CAMBIÓ]

Por favor actualiza los siguientes archivos del cerebro según corresponda:
- docs/cerebro/00-master-context.md (si cambió el stack o la arquitectura)
- docs/cerebro/reglas-negocio.md (si cambió un flujo de negocio)
- docs/cerebro/roles-permisos.md (si cambió un rol o permiso)
- docs/cerebro/estados-despacho.md (si cambió un estado)
- docs/cerebro/modulos.md (si se agregó/suspendió un módulo)
- docs/cerebro/base-datos.md (si cambió el schema)
- docs/cerebro/api-endpoints.md (si cambió una API)
- docs/cerebro/pendientes.md (marcar completadas, agregar nuevas)
- docs/cerebro/decisiones.md (registrar la decisión con fecha)

Solo modifica lo que realmente cambió. No inventes información.
```

---

## 5. Handoff para nueva conversación (contexto completo)

Para retomar trabajo en una conversación nueva sin perder contexto:

```
Hola. Estamos continuando el desarrollo del sistema de gestión CEDI de Grupo Ambiente.

Por favor lee estos archivos para ponerte en contexto:
- docs/cerebro/00-master-context.md
- docs/cerebro/reglas-negocio.md
- docs/cerebro/roles-permisos.md
- docs/cerebro/decisiones.md
- docs/cerebro/pendientes.md

Una vez que hayas leído el contexto, confirma que entendiste:
1. El stack técnico
2. Los módulos activos y suspendidos
3. Las reglas de negocio principales
4. Las tareas pendientes

Luego te contaré en qué quiero trabajar hoy.
```

---

## 6. Revisión de código antes de deploy

Para verificar que todo está correcto antes de hacer push:

```
Antes de hacer deploy a producción, revisa:
1. Lee docs/cerebro/reglas-negocio.md para verificar que el código respeta las reglas
2. Ejecuta: npx tsc --noEmit
3. Ejecuta: npm test
4. Verifica que no se reactivaron módulos suspendidos (logística, rutas, GPS)
5. Confirma que la validación de permisos es doble (server + UI)
6. Revisa docs/cerebro/pendientes.md — ¿hay algo que olvidamos?

Si todo está bien: git push origin master
```

---

## 7. Handoff para Codex (OpenAI)

Para iniciar una sesión en Codex con el mismo protocolo "cerebro" que Claude Code:

```
# Proyecto: Sistema de Gestión CEDI — Grupo Ambiente
# Repositorio: c:\Users\USUARIO\Desktop\almacen-sistema

## Antes de cualquier cambio, lee estos archivos en orden:
1. docs/cerebro/00-master-context.md   ← stack, arquitectura, URL de producción
2. docs/cerebro/reglas-negocio.md      ← flujos, validaciones, módulos suspendidos
3. docs/cerebro/roles-permisos.md      ← los 12 roles y sus permisos
4. docs/cerebro/pendientes.md          ← tareas activas ordenadas por prioridad
5. docs/cerebro/decisiones.md          ← decisiones técnicas recientes

## Protocolo de trabajo
1. Lee el cerebro (archivos arriba) para contextualizarte
2. Implementa la tarea pedida respetando las reglas del proyecto
3. Al terminar, actualiza los archivos del cerebro que correspondan:
   - pendientes.md → marcar completadas, agregar nuevas
   - decisiones.md → registrar la decisión con fecha
   - el archivo temático afectado (modulos.md, base-datos.md, api-endpoints.md, etc.)
4. Valida antes de hacer push:
   npx tsc --noEmit
   npm test
   git push origin master

## Stack
Next.js 16 · React 19 · TypeScript · Prisma 7 · PostgreSQL (Railway) · Vercel
Auth: Auth.js v5 JWT con roles server-side
Rama de trabajo: master → CI/CD automático en Vercel

## Reglas no negociables
- NUNCA reactivar logística, rutas, GPS ni "Mi Ruta" — suspendidos indefinidamente
- Siempre doble validación: server (requireCan / requireRole) + UI (canSeeModule)
- No usar prisma migrate — solo npx prisma db push + npx prisma generate
- Nunca credenciales en archivos versionados (.env* y .vercel/ están en .gitignore)
- Commits cortos y descriptivos en español o inglés

## Fuentes de verdad
- Roles y permisos CRUD → src/lib/permissions.ts
- Visibilidad de módulos → src/lib/modulePermissions.ts
- Tipos TypeScript → src/types/index.ts
- Schema de BD → prisma/schema.prisma
- Navegación → src/components/common/Sidebar.tsx

## La tarea de hoy es:
[DESCRIPCIÓN DE LA TAREA]
```
