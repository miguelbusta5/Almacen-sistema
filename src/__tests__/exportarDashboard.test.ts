// Exportar el dashboard de Indicadores a Excel (24-09): gráficos NATIVOS de
// Excel enlazados a Tablas con filtros, las tarjetas de cifras y todas las
// tablas, una hoja por pestaña, para Almacenamiento y Muebles. Sin imágenes.
import { readFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { cargarNuxt } from "./apoyo/nuxt";

const graficos = cargarNuxt("../app/utils/graficosXlsx.ts", { jszip: JSZip });
const leer = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");
const util = leer("nuxt-app/app/utils/exportarDashboard.ts");

// Las funciones puras de exportarDashboard.ts viven junto a código de Vue: se
// prueban por su texto donde cargarlas pediría un navegador.
const { valorCelda, encabezadosUnicos, unidadDeFormato } = cargarNuxt("../app/utils/exportarDashboard.ts", {
  vue: { inject: () => null, onBeforeUnmount: () => {}, watchEffect: () => {} },
  "~/utils/indicadores": { fmtDiaCorto: (d: string) => d },
  "~/utils/exportarExcel": { nombreHoja: (n: string) => n },
  "~/utils/graficosXlsx": graficos,
});

describe("celdas y encabezados", () => {
  it("números y pesos como número; lo demás como texto", () => {
    expect(valorCelda("1.234")).toEqual({ valor: 1234 });
    expect(valorCelda("12,5")).toEqual({ valor: 12.5 });
    expect(valorCelda("$ 65.540.300")).toEqual({ valor: 65540300, formato: '"$" #,##0' });
    expect(valorCelda("9,9 min")).toEqual({ valor: "9,9 min" });
    expect(valorCelda(undefined)).toEqual({ valor: null });
  });
  it("una Tabla de Excel no acepta encabezados vacíos ni repetidos", () => {
    expect(encabezadosUnicos(["PLU", "", "PLU", "plu"])).toEqual(["PLU", "Columna 2", "PLU (2)", "plu (3)"]);
  });
  it("la unidad sale del formato del eje", () => {
    expect(unidadDeFormato((v: number) => `${v} min`)).toBe("min");
    expect(unidadDeFormato((v: number) => `${Math.round(v)} %`)).toBe("%");
    expect(unidadDeFormato((v: number) => String(v))).toBe("");
  });
});

describe("gráficos nativos", () => {
  const base = {
    hoja: "Movimientos",
    titulo: "Movimientos por operario",
    desde: { col: 0, fila: 3 },
    tamano: { ancho: 760, alto: 300 },
    categorias: { ref: "'Movimientos'!$K$5:$K$6", valores: ["BRYAN", "JOEL"] },
    series: [{
      nombre: "PLU por día", nombreRef: "'Movimientos'!$L$4", ref: "'Movimientos'!$L$5:$L$6",
      valores: [35, 22.5], color: "4A3AA7", colores: ["10B981", null],
    }],
  };

  it("barras horizontales con el semáforo por barra y referencias a la tabla", () => {
    const x = graficos.xmlGrafico({ ...base, tipo: "barras" });
    expect(x).toContain('<c:barDir val="bar"/>');
    expect(x).toContain('<c:grouping val="clustered"/>');
    expect(x).toContain("<c:f>'Movimientos'!$L$5:$L$6</c:f>");
    expect(x).toContain('<c:dPt><c:idx val="0"/>');
    expect(x).toContain('<a:srgbClr val="10B981"/>');
    // Con el separador regional '#,##0.##' dejaba "35,": un decimal si hace falta.
    expect(x).toContain('formatCode="#,##0.0"');
    // Solo lo visible: al filtrar la tabla, el gráfico cambia.
    expect(x).toContain('<c:plotVisOnly val="1"/>');
  });

  it("apiladas y líneas", () => {
    expect(graficos.xmlGrafico({ ...base, tipo: "apiladas" })).toContain('<c:grouping val="stacked"/><c:varyColors val="0"/>');
    const l = graficos.xmlGrafico({ ...base, tipo: "linea" });
    expect(l).toContain("<c:lineChart>");
    expect(l).toContain('<c:symbol val="circle"/>');
  });

  it("texto escapado y referencias con comillas", () => {
    expect(graficos.xml('A & B <c> "d"')).toBe("A &amp; B &lt;c&gt; &quot;d&quot;");
    expect(graficos.refHoja("Tiempo d'O", "$A$1")).toBe("'Tiempo d''O'!$A$1");
    expect(graficos.letraColumna(0)).toBe("A");
    expect(graficos.letraColumna(27)).toBe("AB");
    expect(graficos.rangoAbs(10, 5, 9)).toBe("$K$5:$K$9");
  });

  it("se inyectan en un libro de exceljs con tablas: partes, relaciones y <drawing> antes de <tableParts>", async () => {
    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet("Movimientos");
    hoja.addTable({
      name: "Grafico_1_1", ref: "K4", headerRow: true,
      columns: [{ name: "Nombre", filterButton: true }, { name: "PLU por día", filterButton: true }],
      rows: [["BRYAN", 35], ["JOEL", 22.5]],
    });
    const buffer = await libro.xlsx.writeBuffer();
    const salida = await graficos.agregarGraficos(buffer, [{ ...base, tipo: "barras" }, { ...base, tipo: "linea" }]);
    const zip = await JSZip.loadAsync(salida);
    const nombres = Object.keys(zip.files);
    expect(nombres).toEqual(expect.arrayContaining([
      "xl/charts/chart1.xml", "xl/charts/chart2.xml", "xl/drawings/drawing1.xml", "xl/drawings/_rels/drawing1.xml.rels",
    ]));
    const tipos = await zip.file("[Content_Types].xml")!.async("string");
    expect(tipos).toContain('PartName="/xl/charts/chart1.xml"');
    expect(tipos).toContain('PartName="/xl/drawings/drawing1.xml"');
    const xmlHoja = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    expect(xmlHoja.indexOf("<drawing ")).toBeGreaterThan(0);
    expect(xmlHoja.indexOf("<drawing ")).toBeLessThan(xmlHoja.indexOf("<tableParts"));
    const rels = await zip.file("xl/worksheets/_rels/sheet1.xml.rels")!.async("string");
    expect(rels).toContain("relationships/table");
    expect(rels).toContain('Target="../drawings/drawing1.xml"');
    // Tamaño fijo (no anclado a celdas que se ensanchan).
    const dibujo = await zip.file("xl/drawings/drawing1.xml")!.async("string");
    expect(dibujo).toContain('<xdr:ext cx="7239000" cy="2857500"/>');
    expect(dibujo.match(/<c:chart r:id=/g)).toHaveLength(2);
  });
});

describe("módulos y componentes", () => {
  const alm = leer("nuxt-app/app/components/indicadores/Module.vue");
  const mue = leer("nuxt-app/app/components/indicadores-muebles/Module.vue");

  it("un botón «Exportar dashboard» por área que recorre todas sus pestañas", () => {
    for (const m of [alm, mue]) {
      expect(m).toContain("Exportar dashboard");
      expect(m).toContain("exportarDashboard({");
      expect(m).toContain('<div ref="contenidoTab">');
      expect(m).toContain("crearColector(ref(false))");
    }
    expect(alm).toContain("...PESTANAS_PROCESO,");
    expect(mue).toContain("{ key: 'ordenes', label: 'Órdenes' }");
  });

  it("sin imágenes: los gráficos se anotan con sus datos y van nativos", () => {
    expect(util).not.toContain("html-to-image");
    expect(leer("nuxt-app/package.json")).not.toContain("html-to-image");
    expect(util).toContain("return agregarGraficos(buffer, graficos)");
    for (const c of ["BarrasH", "BarrasApiladas", "LineaDiaria"]) {
      expect(leer(`nuxt-app/app/components/indicadores/${c}.vue`)).toContain("usarRegistroGrafico(");
    }
  });

  it("todo va en Tablas de Excel con filtros, con nombres que no parecen celdas", () => {
    expect(util).toContain("columns: nombres.map((n) => ({ name: n, filterButton: true }))");
    // «T1» es la celda T1: Excel rechazaba el archivo. Siempre prefijo_hoja_n.
    expect(util).toContain("const nombreTabla = (pref: string) => `${pref}_${iHoja + 1}_${++nTabla}`");
  });

  it("las tarjetas de cifras se marcan para salir como tabla de indicadores", () => {
    expect(leer("nuxt-app/app/components/indicadores/CifraProceso.vue")).toContain('<div class="cp" data-kpi>');
    expect(alm).toContain('class="heroe card" data-kpi');
    expect(leer("nuxt-app/app/components/indicadores-muebles/Analitica.vue")).toContain('class="an-tile" data-kpi');
  });

  it("las líneas de una tarjeta se juntan en un gráfico con un color por serie", () => {
    expect(util).toContain("g.tipo === 'linea' && previo?.tipo === 'linea' && g.tarjeta && previo.tarjeta === g.tarjeta");
    expect(util).toContain("color: PALETA_SERIES[i % PALETA_SERIES.length]!");
    expect(leer("nuxt-app/app/components/indicadores/EvolucionPersonas.vue")).toContain(':serie="p.nombre"');
  });
});
