// Exportar el dashboard de Indicadores (24-09): una hoja por pestaña con sus
// tarjetas y gráficos (imagen) y todos sus datos como celdas, para las dos
// áreas (Almacenamiento y Muebles).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cargarNuxt } from "./apoyo/nuxt";

const { fuentesLatinas, valorCelda } = cargarNuxt("../app/utils/exportarDashboard.ts", {
  "~/utils/exportarExcel": { nombreHoja: (n: string) => n },
});
const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

describe("celdas", () => {
  it("números y pesos como número; lo demás como texto", () => {
    expect(valorCelda("1.234")).toEqual({ valor: 1234 });
    expect(valorCelda("12,5")).toEqual({ valor: 12.5 });
    expect(valorCelda("$ 65.540.300")).toEqual({ valor: 65540300, formato: '"$" #,##0' });
    expect(valorCelda("9,9 min")).toEqual({ valor: "9,9 min" });
    expect(valorCelda(42)).toEqual({ valor: 42 });
    expect(valorCelda(undefined)).toEqual({ valor: "" });
  });
});

describe("fuentes", () => {
  const cara = (fam: string, peso: number, rango: string) =>
    `@font-face { font-family: ${fam}; font-style: normal; font-weight: ${peso}; src: url(x) format("woff2"); unicode-range: ${rango}; }`;
  it("solo el alfabeto latino y cada variante una vez (el CSS completo pesa MB)", () => {
    const css = [
      cara("Inter", 400, "U+460-52F, U+1C80-1C8A"), // cirílico
      cara("Inter", 400, "U+0-FF, U+131, U+152-153"), // latino
      cara("Inter", 400, "U+0-FF, U+131, U+152-153"), // repetida
      cara("Inter", 700, "U+0-FF, U+131"),
      cara("Sora", 800, "U+0000-00FF"),
    ].join("\n");
    const r = fuentesLatinas(css);
    expect(r.match(/@font-face/g)).toHaveLength(3);
    expect(r).not.toContain("U+460-52F");
  });
});

describe("módulos", () => {
  const alm = leer("nuxt-app/app/components/indicadores/Module.vue");
  const mue = leer("nuxt-app/app/components/indicadores-muebles/Module.vue");
  const util = leer("nuxt-app/app/utils/exportarDashboard.ts");

  it("un botón «Exportar dashboard» por área que recorre todas sus pestañas", () => {
    for (const m of [alm, mue]) {
      expect(m).toContain("Exportar dashboard");
      expect(m).toContain("exportarDashboard({");
      expect(m).toContain('<div ref="contenidoTab">');
      expect(m).toContain("provide(CLAVE_COLECTOR, colector)");
    }
    expect(alm).toContain("...PESTANAS_PROCESO,");
    expect(alm).toContain("{ key: 'laborado', label: 'Tiempo trabajado' }");
    expect(mue).toContain("{ key: 'ordenes', label: 'Órdenes' }");
    // Los botones sueltos de antes ya no están.
    expect(alm).not.toContain("exportarLaborado");
    expect(leer("nuxt-app/app/components/indicadores/Procesos.vue")).not.toContain("Exportar a Excel");
  });

  it("las tarjetas montan su tabla al exportar y las tablas se anotan con sus datos", () => {
    const tarjeta = leer("nuxt-app/app/components/indicadores/Tarjeta.vue");
    const tabla = leer("nuxt-app/app/components/indicadores/Tabla.vue");
    expect(tarjeta).toContain('<div v-if="exportando && !verTabla" class="tj-solo-export" data-export-omitir><slot name="tabla" /></div>');
    expect(tabla).toContain("colector.tablas.set(id, {");
    expect(tabla).toContain("onBeforeUnmount(() => colector?.tablas.delete(id))");
  });

  it("los gráficos SVG salen con color (estilos en línea mientras se fotografía) y nada se cuelga", () => {
    expect(util).toContain("const restaurar = estilosSvgEnLinea(b)");
    expect(util).toContain("restaurar()");
    expect(util).toContain("conLimite(toPng(b, {");
    // Al terminar (o fallar) se vuelve a la pestaña en que estaba.
    expect(util).toMatch(/finally \{\n    opts\.colector\.activo\.value = false\n    opts\.irA\(opts\.actual\)/);
  });
});
