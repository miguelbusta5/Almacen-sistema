// Gráficas nativas de Excel para libros generados con ExcelJS.
//
// ExcelJS (4.4) no sabe crear gráficas: no expone ninguna API de charts. La única
// forma de tener gráficas *de verdad* (seleccionables, ligadas a las celdas, que se
// actualizan si editas los datos) es escribir a mano las partes OOXML y meterlas en
// el .xlsx, que no es más que un zip. Eso hace `injectCharts`: abre el buffer que
// devolvió ExcelJS, añade xl/charts/chartN.xml + xl/drawings/drawingM.xml, sus rels,
// y parchea [Content_Types].xml y el XML de cada hoja.
//
// El orden de los elementos dentro de cada parte NO es libre: el schema de OOXML es
// una secuencia, y Excel abre el diálogo de "contenido no legible" si algo va fuera
// de sitio. Por eso los strings de abajo están escritos en el orden del schema y hay
// comentarios donde es fácil equivocarse.
//
// NOTA: portado 1:1 en nuxt-app/server/utils/excelCharts.ts. Mantener ambos en sync.
import JSZip from "jszip";

export type ChartType = "bar" | "barStacked" | "line";

export interface ChartSerie {
  /** Ref A1 absoluta a la celda con el nombre de la serie. */
  nameRef: string;
  /** Ref A1 absoluta al rango de valores. */
  valuesRef: string;
}

export interface ChartSpec {
  type: ChartType;
  title: string;
  /** Nombre de la hoja donde se ancla la gráfica. */
  sheet: string;
  /** Ref A1 absoluta al rango de categorías (eje X). */
  categories: string;
  series: ChartSerie[];
  /** Posición en la cuadrícula de la hoja, 0-based. */
  anchor: { fromCol: number; fromRow: number; toCol: number; toRow: number };
}

const NS_C = "http://schemas.openxmlformats.org/drawingml/2006/chart";
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_XDR = "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing";
const NS_REL_PKG = "http://schemas.openxmlformats.org/package/2006/relationships";

const CT_CHART = "application/vnd.openxmlformats-officedocument.drawingml.chart+xml";
const CT_DRAWING = "application/vnd.openxmlformats-officedocument.drawing+xml";

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** 0-based → letra de columna (0 → A, 26 → AA). */
export function colLetter(index: number): string {
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/**
 * Ref A1 absoluta con la hoja entrecomillada. Las hojas del reporte llevan espacios
 * y tildes ("Unidades por día"), y sin comillas simples Excel no resuelve el rango.
 * Filas y columnas van 0-based, como el resto del módulo.
 */
export function cellRef(sheet: string, col: number, row: number): string {
  return `'${sheet.replace(/'/g, "''")}'!$${colLetter(col)}$${row + 1}`;
}

export function rangeRef(
  sheet: string,
  fromCol: number,
  fromRow: number,
  toCol: number,
  toRow: number,
): string {
  const name = sheet.replace(/'/g, "''");
  return `'${name}'!$${colLetter(fromCol)}$${fromRow + 1}:$${colLetter(toCol)}$${toRow + 1}`;
}

// ── XML de las partes ────────────────────────────────────────────────

function serieXml(serie: ChartSerie, categories: string, index: number, type: ChartType): string {
  // El orden dentro de <c:ser> es el del schema (idx, order, tx, …, cat, val).
  // `invertIfNegative` solo existe en barras; `smooth` solo en líneas.
  const especifico =
    type === "line" ? '<c:marker><c:symbol val="circle"/><c:size val="5"/></c:marker>' : '<c:invertIfNegative val="0"/>';
  const cierre = type === "line" ? '<c:smooth val="0"/>' : "";
  return (
    "<c:ser>" +
    `<c:idx val="${index}"/><c:order val="${index}"/>` +
    `<c:tx><c:strRef><c:f>${escapeXml(serie.nameRef)}</c:f></c:strRef></c:tx>` +
    especifico +
    `<c:cat><c:strRef><c:f>${escapeXml(categories)}</c:f></c:strRef></c:cat>` +
    `<c:val><c:numRef><c:f>${escapeXml(serie.valuesRef)}</c:f></c:numRef></c:val>` +
    cierre +
    "</c:ser>"
  );
}

function chartXml(spec: ChartSpec, chartIndex: number): string {
  // Los axId son arbitrarios pero tienen que coincidir entre el grupo y los ejes,
  // y ser únicos dentro del chart. Se derivan del índice para que sean estables.
  const catAxId = 100000000 + chartIndex * 2;
  const valAxId = catAxId + 1;
  const series = spec.series.map((s, i) => serieXml(s, spec.categories, i, spec.type)).join("");

  const grupo =
    spec.type === "line"
      ? "<c:lineChart>" +
        '<c:grouping val="standard"/><c:varyColors val="0"/>' +
        series +
        '<c:marker val="1"/>' +
        `<c:axId val="${catAxId}"/><c:axId val="${valAxId}"/>` +
        "</c:lineChart>"
      : "<c:barChart>" +
        '<c:barDir val="col"/>' +
        `<c:grouping val="${spec.type === "barStacked" ? "stacked" : "clustered"}"/>` +
        '<c:varyColors val="0"/>' +
        series +
        `<c:gapWidth val="150"/><c:overlap val="${spec.type === "barStacked" ? 100 : -20}"/>` +
        `<c:axId val="${catAxId}"/><c:axId val="${valAxId}"/>` +
        "</c:barChart>";

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<c:chartSpace xmlns:c="${NS_C}" xmlns:a="${NS_A}" xmlns:r="${NS_R}">` +
    "<c:chart>" +
    "<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r>" +
    `<a:t>${escapeXml(spec.title)}</a:t>` +
    "</a:r></a:p></c:rich></c:tx><c:overlay val=\"0\"/></c:title>" +
    '<c:autoTitleDeleted val="0"/>' +
    "<c:plotArea><c:layout/>" +
    grupo +
    `<c:catAx><c:axId val="${catAxId}"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
    '<c:delete val="0"/><c:axPos val="b"/><c:tickLblPos val="nextTo"/>' +
    `<c:crossAx val="${valAxId}"/></c:catAx>` +
    `<c:valAx><c:axId val="${valAxId}"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
    '<c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/><c:tickLblPos val="nextTo"/>' +
    `<c:crossAx val="${catAxId}"/></c:valAx>` +
    "</c:plotArea>" +
    '<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>' +
    '<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/>' +
    "</c:chart>" +
    "</c:chartSpace>"
  );
}

function drawingXml(specs: ChartSpec[]): string {
  const anchors = specs
    .map((spec, i) => {
      const { fromCol, fromRow, toCol, toRow } = spec.anchor;
      return (
        "<xdr:twoCellAnchor>" +
        `<xdr:from><xdr:col>${fromCol}</xdr:col><xdr:colOff>0</xdr:colOff>` +
        `<xdr:row>${fromRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
        `<xdr:to><xdr:col>${toCol}</xdr:col><xdr:colOff>0</xdr:colOff>` +
        `<xdr:row>${toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>` +
        '<xdr:graphicFrame macro="">' +
        "<xdr:nvGraphicFramePr>" +
        `<xdr:cNvPr id="${i + 2}" name="Grafica ${i + 1}"/>` +
        "<xdr:cNvGraphicFramePr/>" +
        "</xdr:nvGraphicFramePr>" +
        '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>' +
        `<a:graphic><a:graphicData uri="${NS_C}">` +
        `<c:chart xmlns:c="${NS_C}" xmlns:r="${NS_R}" r:id="rId${i + 1}"/>` +
        "</a:graphicData></a:graphic>" +
        "</xdr:graphicFrame>" +
        "<xdr:clientData/>" +
        "</xdr:twoCellAnchor>"
      );
    })
    .join("");

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<xdr:wsDr xmlns:xdr="${NS_XDR}" xmlns:a="${NS_A}" xmlns:r="${NS_R}">` +
    anchors +
    "</xdr:wsDr>"
  );
}

function relsXml(rels: { id: string; type: string; target: string }[]): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<Relationships xmlns="${NS_REL_PKG}">` +
    rels
      .map((r) => `<Relationship Id="${r.id}" Type="${escapeXml(r.type)}" Target="${escapeXml(r.target)}"/>`)
      .join("") +
    "</Relationships>"
  );
}

// ── Utilidades de zip ────────────────────────────────────────────────

async function readText(zip: JSZip, path: string): Promise<string | null> {
  const file = zip.file(path);
  return file ? file.async("string") : null;
}

/**
 * Nombre de hoja → ruta de su XML. Hay que pasar por workbook.xml (que tiene los
 * nombres) y por sus rels (que tienen las rutas): el orden de <sheet> no garantiza
 * que "la segunda hoja" sea sheet2.xml.
 */
async function mapSheetPaths(zip: JSZip): Promise<Map<string, string>> {
  const workbook = (await readText(zip, "xl/workbook.xml")) ?? "";
  const rels = (await readText(zip, "xl/_rels/workbook.xml.rels")) ?? "";

  const targetById = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /Id="([^"]+)"/.exec(m[0])?.[1];
    const target = /Target="([^"]+)"/.exec(m[0])?.[1];
    if (!id || !target) continue;
    const clean = target.replace(/^\/xl\//, "").replace(/^\.\//, "");
    targetById.set(id, clean.startsWith("xl/") ? clean : `xl/${clean}`);
  }

  const out = new Map<string, string>();
  for (const m of workbook.matchAll(/<sheet\b[^>]*\/>/g)) {
    const name = /name="([^"]*)"/.exec(m[0])?.[1];
    const rid = /r:id="([^"]+)"/.exec(m[0])?.[1];
    if (!name || !rid) continue;
    const path = targetById.get(rid);
    if (path) out.set(unescapeXml(name), path);
  }
  return out;
}

function nextRelId(relsContent: string): number {
  let max = 0;
  for (const m of relsContent.matchAll(/Id="rId(\d+)"/g)) {
    max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

/**
 * Inserta <drawing/> respetando la secuencia del schema: va casi al final, pero
 * *antes* de <tableParts> y <extLst>. Añadirlo a ciegas antes de </worksheet>
 * rompe el archivo en cuanto la hoja tiene una tabla o un autoFilter con extLst.
 */
function insertDrawingRef(sheetXml: string, relId: string): string {
  const tag = `<drawing r:id="${relId}"/>`;
  for (const anchor of ["<tableParts", "<extLst"]) {
    const at = sheetXml.indexOf(anchor);
    if (at !== -1) return sheetXml.slice(0, at) + tag + sheetXml.slice(at);
  }
  return sheetXml.replace("</worksheet>", `${tag}</worksheet>`);
}

function addContentTypeOverrides(xml: string, overrides: { part: string; type: string }[]): string {
  const nuevos = overrides
    .filter((o) => !xml.includes(`PartName="${o.part}"`))
    .map((o) => `<Override PartName="${o.part}" ContentType="${o.type}"/>`)
    .join("");
  return nuevos ? xml.replace("</Types>", `${nuevos}</Types>`) : xml;
}

// ── API pública ──────────────────────────────────────────────────────

/**
 * Añade gráficas nativas a un .xlsx ya generado. Devuelve un buffer nuevo; no
 * modifica el original. Las specs se agrupan por hoja: cada hoja recibe un único
 * drawing con tantos anclajes como gráficas tenga.
 */
export async function injectCharts(
  xlsx: ArrayBuffer | Buffer | Uint8Array,
  specs: ChartSpec[],
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(xlsx);
  if (specs.length === 0) return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

  const sheetPaths = await mapSheetPaths(zip);

  const porHoja = new Map<string, ChartSpec[]>();
  for (const spec of specs) {
    const lista = porHoja.get(spec.sheet);
    if (lista) lista.push(spec);
    else porHoja.set(spec.sheet, [spec]);
  }

  const overrides: { part: string; type: string }[] = [];
  let chartIndex = 0;
  let drawingIndex = 0;

  for (const [sheetName, sheetSpecs] of porHoja) {
    const sheetPath = sheetPaths.get(sheetName);
    if (!sheetPath) throw new Error(`No existe la hoja "${sheetName}" en el libro`);

    drawingIndex += 1;
    const drawingPath = `xl/drawings/drawing${drawingIndex}.xml`;
    const drawingRels: { id: string; type: string; target: string }[] = [];

    sheetSpecs.forEach((spec, i) => {
      chartIndex += 1;
      const chartPath = `xl/charts/chart${chartIndex}.xml`;
      zip.file(chartPath, chartXml(spec, chartIndex));
      overrides.push({ part: `/${chartPath}`, type: CT_CHART });
      drawingRels.push({
        id: `rId${i + 1}`,
        type: `${NS_R}/chart`,
        target: `../charts/chart${chartIndex}.xml`,
      });
    });

    zip.file(drawingPath, drawingXml(sheetSpecs));
    zip.file(`xl/drawings/_rels/drawing${drawingIndex}.xml.rels`, relsXml(drawingRels));
    overrides.push({ part: `/${drawingPath}`, type: CT_DRAWING });

    // Rels de la hoja: pueden no existir todavía (ExcelJS solo las escribe si hacen falta).
    const sheetFile = sheetPath.split("/").pop()!;
    const sheetRelsPath = `xl/worksheets/_rels/${sheetFile}.rels`;
    const existentes = await readText(zip, sheetRelsPath);
    const relId = `rId${existentes ? nextRelId(existentes) : 1}`;
    const relacion = `<Relationship Id="${relId}" Type="${NS_R}/drawing" Target="../drawings/drawing${drawingIndex}.xml"/>`;
    zip.file(
      sheetRelsPath,
      existentes
        ? existentes.replace("</Relationships>", `${relacion}</Relationships>`)
        : relsXml([
            { id: relId, type: `${NS_R}/drawing`, target: `../drawings/drawing${drawingIndex}.xml` },
          ]),
    );

    const sheetXml = await readText(zip, sheetPath);
    if (!sheetXml) throw new Error(`No se pudo leer ${sheetPath}`);
    zip.file(sheetPath, insertDrawingRef(sheetXml, relId));
  }

  const contentTypes = await readText(zip, "[Content_Types].xml");
  if (!contentTypes) throw new Error("El .xlsx no tiene [Content_Types].xml");
  zip.file("[Content_Types].xml", addContentTypeOverrides(contentTypes, overrides));

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
