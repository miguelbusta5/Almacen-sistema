// Cargar codigo de nuxt-app dentro de los tests, SIN importarlo.
//
// `nuxt-app/` es otro proyecto: tiene sus propias dependencias y un tsconfig que
// apunta a `.nuxt/` (lo genera `nuxt prepare` y no esta versionado). Un import
// normal desde aqui obliga a CI a resolver todo eso y revienta:
//   - `npx tsc --noEmit` de la raiz: "Cannot find module 'h3'"
//   - vitest: "Failed to load tsconfig 'nuxt-app/.nuxt/tsconfig.app.json'"
// Paso el 22-09 con inventarios, stretch y la reasignacion de picking: los dos
// despliegues se quedaron sin salir.
//
// Aqui el archivo se lee como texto, se transpila y se ejecuta con las
// dependencias que le pasemos. Es lo que ya hacia pickingHandlers.test.ts; esto
// solo lo deja en un sitio para todos.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const requerirReal = createRequire(import.meta.url);

/** Paquetes reales que el codigo del servidor puede usar tal cual. */
const REALES = new Set(['zod']);

/**
 * Ejecuta un archivo de `nuxt-app/server` y devuelve sus exports.
 *
 * `deps` son los modulos que el archivo importa, con la MISMA ruta que usa en su
 * import (`'h3'`, `'../../utils/prisma'`…). Lo que no este ahi y no sea de Node
 * lanza error a proposito: un mock que falta debe verse, no pasar como undefined.
 */
export function cargarNuxt<T = Record<string, any>>(rel: string, deps: Record<string, unknown> = {}): T {
  const fuente = readFileSync(path.resolve('nuxt-app/server', rel), 'utf8');
  const codigo = ts.transpileModule(fuente, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports: Record<string, any> = {};
  const requerir = (clave: string) => {
    if (clave in deps) return deps[clave];
    if (clave.startsWith('node:') || REALES.has(clave)) return requerirReal(clave);
    throw new Error(`Falta el doble de '${clave}' para cargar ${rel}`);
  };
  new Function('require', 'exports', codigo)(requerir, exports);
  return exports as T;
}

/** Lo mismo, para un endpoint: devuelve su handler (el export por defecto). */
export function cargarHandlerNuxt(rel: string, deps: Record<string, unknown> = {}): any {
  return cargarNuxt<{ default: any }>(rel, deps).default;
}

/** h3 de mentira: lo minimo que usan los endpoints, mas lo que le agregue cada test. */
export function h3Falso(extra: Record<string, unknown> = {}) {
  return {
    defineEventHandler: (fn: unknown) => fn,
    createError: (datos: object) => Object.assign(new Error(), datos),
    ...extra,
  };
}
