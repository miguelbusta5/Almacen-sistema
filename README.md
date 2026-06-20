# Control Logístico CEDI — Grupo Ambiente

Aplicación web interna para operar el CEDI (inventario, facturas contado, solicitudes de transporte,
guardados, preoperacional, exportaciones e integración de pedidos). Next.js 16 · React 19 · TypeScript ·
Prisma 7 · PostgreSQL (Railway) · Vercel.

## 📖 Documentación

> **La fuente de verdad del proyecto es [`PROJECT_SOURCE_OF_TRUTH.md`](PROJECT_SOURCE_OF_TRUTH.md).**
> Léelo primero: contiene visión, roles, módulos, reglas de UI/diseño/tablas/estados/permisos,
> arquitectura frontend y qué no tocar sin autorización.

- **Fuente de verdad:** [`PROJECT_SOURCE_OF_TRUTH.md`](PROJECT_SOURCE_OF_TRUTH.md)
- **Instrucciones a agentes:** [`CLAUDE.md`](CLAUDE.md) · [`AGENTS.md`](AGENTS.md)
- **Detalle operativo (subordinado al SOT):** [`docs/cerebro/`](docs/cerebro/)
- **Referencia histórica (no usar como instrucción):** `docs/cerebro/{decisiones,pendientes,bugs,auditoria-ui}.md`,
  y `HANDOFF.md` (OBSOLETO).

## Comandos

```bash
npm run dev            # desarrollo (Turbopack)
npx tsc --noEmit       # type-check (obligatorio antes de push)
npm test               # vitest
npm run build          # build de producción
git push origin master # deploy a producción (CI: tsc + tests + vercel)
```

Producción: https://matec-cedi.vercel.app
