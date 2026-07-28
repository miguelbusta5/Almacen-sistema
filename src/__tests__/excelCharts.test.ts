import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { cellRef, colLetter, injectCharts, rangeRef, type ChartSpec } from "@/lib/excelCharts";
import { readWorkbook, workbookBuffer } from "@/lib/excel";

const HOJA = "Unidades por día";

async function libroDemo(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(HOJA);
  ws.addRows([
    ["Fecha", "Ana", "Luis"],
    ["2026-07-01", 10, 20],
    ["2026-07-02", 15, 5],
  ]);
  // Una hoja con autoFilter obliga a insertar el <drawing/> en el sitio correcto.
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 3, column: 3 } };
  wb.addWorksheet("Otra").addRows([["x"], [1]]);
  return workbookBuffer(wb);
}

const specs: ChartSpec[] = [
  {
    type: "line",
    title: "Unidades por día",
    sheet: HOJA,
    categories: rangeRef(HOJA, 0, 1, 0, 2),
    series: [
      { nameRef: cellRef(HOJA, 1, 0), valuesRef: rangeRef(HOJA, 1, 1, 1, 2) },
      { nameRef: cellRef(HOJA, 2, 0), valuesRef: rangeRef(HOJA, 2, 1, 2, 2) },
    ],
    anchor: { fromCol: 5, fromRow: 1, toCol: 13, toRow: 17 },
  },
  {
    type: "barStacked",
    title: "Total & acumulado",
    sheet: HOJA,
    categories: rangeRef(HOJA, 0, 1, 0, 2),
    series: [{ nameRef: cellRef(HOJA, 1, 0), valuesRef: rangeRef(HOJA, 1, 1, 1, 2) }],
    anchor: { fromCol: 5, fromRow: 19, toCol: 13, toRow: 35 },
  },
];

describe("refs A1", () => {
  it("convierte indices de columna a letras", () => {
    expect([0, 1, 25, 26, 27, 51, 52].map(colLetter)).toEqual(["A", "B", "Z", "AA", "AB", "AZ", "BA"]);
  });

  it("entrecomilla la hoja y usa refs absolutas 1-based", () => {
    expect(cellRef("Tiempos por usuario", 1, 0)).toBe("'Tiempos por usuario'!$B$1");
    expect(rangeRef(HOJA, 0, 1, 2, 10)).toBe("'Unidades por día'!$A$2:$C$11");
  });
});

describe("injectCharts", () => {
  it("añade las partes OOXML y deja el libro legible", async () => {
    const buf = await injectCharts(await libroDemo(), specs);
    const zip = await JSZip.loadAsync(buf);

    expect(zip.file("xl/charts/chart1.xml")).toBeTruthy();
    expect(zip.file("xl/charts/chart2.xml")).toBeTruthy();
    expect(zip.file("xl/charts/chart3.xml")).toBeNull();
    expect(zip.file("xl/drawings/drawing1.xml")).toBeTruthy();
    expect(zip.file("xl/drawings/_rels/drawing1.xml.rels")).toBeTruthy();

    const types = await zip.file("[Content_Types].xml")!.async("string");
    expect(types).toContain('PartName="/xl/charts/chart1.xml"');
    expect(types).toContain('PartName="/xl/drawings/drawing1.xml"');

    // Las dos gráficas de la misma hoja comparten un único drawing.
    const drawing = await zip.file("xl/drawings/drawing1.xml")!.async("string");
    expect(drawing.match(/<xdr:twoCellAnchor>/g)).toHaveLength(2);

    // El <drawing/> va antes de <extLst>/<tableParts>, no pegado a </worksheet>.
    const hoja = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
    expect(hoja).toMatch(/<drawing r:id="rId\d+"\/>/);
    const posDrawing = hoja.indexOf("<drawing ");
    const posExt = hoja.indexOf("<extLst");
    if (posExt !== -1) expect(posDrawing).toBeLessThan(posExt);

    const rels = await zip.file("xl/worksheets/_rels/sheet1.xml.rels")!.async("string");
    expect(rels).toContain("../drawings/drawing1.xml");

    // Round-trip: los datos siguen ahí y el libro se vuelve a abrir sin errores.
    const releido = await readWorkbook(buf);
    expect(releido.getWorksheet(HOJA)!.getCell("B2").value).toBe(10);
  });

  it("referencia las series y categorias con la hoja entrecomillada", async () => {
    const buf = await injectCharts(await libroDemo(), specs);
    const zip = await JSZip.loadAsync(buf);
    const chart = await zip.file("xl/charts/chart1.xml")!.async("string");

    expect(chart).toContain("<c:lineChart>");
    expect(chart).toContain("&apos;Unidades por día&apos;!$A$2:$A$3");
    expect(chart.match(/<c:ser>/g)).toHaveLength(2);
    // El axId del grupo tiene que coincidir con el de los ejes.
    const axIds = [...chart.matchAll(/<c:axId val="(\d+)"\/>/g)].map((m) => m[1]);
    expect(new Set(axIds).size).toBe(2);
    expect(axIds).toHaveLength(4);
  });

  it("marca las barras apiladas como stacked", async () => {
    const zip = await JSZip.loadAsync(await injectCharts(await libroDemo(), specs));
    const chart = await zip.file("xl/charts/chart2.xml")!.async("string");
    expect(chart).toContain('<c:grouping val="stacked"/>');
    expect(chart).toContain('<c:overlap val="100"/>');
  });

  it("no toca el libro si no hay specs", async () => {
    const buf = await injectCharts(await libroDemo(), []);
    const zip = await JSZip.loadAsync(buf);
    expect(zip.file("xl/charts/chart1.xml")).toBeNull();
    expect((await readWorkbook(buf)).worksheets).toHaveLength(2);
  });

  it("falla claro si la hoja no existe", async () => {
    await expect(
      injectCharts(await libroDemo(), [{ ...specs[0], sheet: "Inexistente" }]),
    ).rejects.toThrow(/Inexistente/);
  });
});
