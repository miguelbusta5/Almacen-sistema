import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";

// ─────────────────────────────────────────────────────────────────────────
// BLINDAJE GLOBAL — tablas con rail lateral.
// Prohíbe pseudo-elementos sobre FILAS de tabla (`tr::before`/`::after`,
// `.ds-row::before`, etc.). En Chrome, un ::before sobre un display:table-row
// se materializa como una CELDA DE TABLA ANÓNIMA que ocupa la primera columna y
// CORRE todas las columnas una posición a la derecha (bug real de Facturas
// Contado / Guardados). El rail debe ser paint-only: box-shadow/border-left en
// `td:first-child`. Ver PROJECT_SOURCE_OF_TRUTH.md §9.
// ─────────────────────────────────────────────────────────────────────────

function walkCss(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walkCss(full));
    else if (name.endsWith(".css")) out.push(full);
  }
  return out;
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

const srcDir = path.join(process.cwd(), "src");
const cssFiles = walkCss(srcDir);

// Patrones prohibidos: pseudo-elemento aplicado a una fila de tabla.
const FORBIDDEN: { re: RegExp; desc: string }[] = [
  { re: /\btr\s*::?\s*(before|after)\b/i, desc: "tr::before / tr::after" },
  { re: /\btbody\s+tr\s*::?\s*(before|after)\b/i, desc: "tbody tr::before/::after" },
  { re: /\bthead\s+tr\s*::?\s*(before|after)\b/i, desc: "thead tr::before/::after" },
  { re: /\.ds-row\s*::?\s*(before|after)\b/i, desc: ".ds-row::before/::after" },
];

describe("CSS guard — sin pseudo-elementos sobre filas de tabla", () => {
  it("escanea al menos un archivo .css", () => {
    expect(cssFiles.length).toBeGreaterThan(0);
  });

  for (const file of cssFiles) {
    const rel = path.relative(process.cwd(), file).replace(/\\/g, "/");
    it(`${rel} no dibuja rails con pseudo-elementos sobre <tr>`, () => {
      const css = stripComments(readFileSync(file, "utf8"));
      const violations = FORBIDDEN.filter(({ re }) => re.test(css)).map(({ desc }) => desc);
      // Si falla: mueve el rail a `box-shadow: inset 3px 0 0 var(--row-color)` en td:first-child.
      expect(violations).toEqual([]);
    });
  }
});
