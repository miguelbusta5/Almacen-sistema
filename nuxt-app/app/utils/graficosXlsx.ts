// Gráficos NATIVOS de Excel dentro de un .xlsx armado con exceljs (24-09).
//
// exceljs escribe celdas, tablas y estilos, pero no gráficos. Aquí se abre el
// .xlsx ya generado (es un zip) y se le agregan las partes de DrawingML que
// Excel usa para sus gráficos: xl/charts/chartN.xml, xl/drawings/drawingN.xml,
// sus relaciones, la referencia <drawing> en la hoja y los tipos de contenido.
//
// Cada serie apunta a un rango de la hoja (una Tabla de Excel con filtros): si
// se filtra la tabla, el gráfico muestra solo lo visible, como hace Excel con
// cualquier gráfico. Se guarda también la caché de valores para que el archivo
// se vea bien aunque el programa no recalcule al abrir.

export type TipoGraficoXlsx = 'barras' | 'apiladas' | 'linea'

export interface SerieXlsx {
  /** Celda con el nombre de la serie (encabezado de su columna). */
  nombreRef: string
  nombre: string
  /** Rango con los valores. */
  ref: string
  valores: Array<number | null>
  /** RRGGBB. */
  color: string
  /** Color por barra (semáforo); null = el de la serie. */
  colores?: Array<string | null>
}

export interface GraficoXlsx {
  hoja: string
  tipo: TipoGraficoXlsx
  titulo: string
  /** Celda de la esquina superior izquierda (columnas y filas desde 0). */
  desde: { col: number; fila: number }
  /**
   * Tamaño fijo en píxeles: anclado a celdas, el gráfico se estiraba con el
   * ancho de las columnas (que crecen con las tablas de datos de abajo).
   */
  tamano: { ancho: number; alto: number }
  categorias: { ref: string; valores: string[] }
  series: SerieXlsx[]
  /** Formato de las etiquetas de valor y del eje ("#,##0.0"). */
  formato?: string
}

const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const REL_DRAWING = `${NS_REL}/drawing`
const REL_CHART = `${NS_REL}/chart`
const CT_DRAWING = 'application/vnd.openxmlformats-officedocument.drawing+xml'
const CT_CHART = 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml'

export function xml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** 'Hoja con espacios'!$A$1:$A$5 */
export function refHoja(hoja: string, rango: string): string {
  return `'${hoja.replace(/'/g, "''")}'!${rango}`
}

/** Columna 0 → "A", 27 → "AB". */
export function letraColumna(indice: number): string {
  let n = indice + 1
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/** $B$5:$B$12 (filas desde 1, columna desde 0). */
export function rangoAbs(col: number, filaIni: number, filaFin: number): string {
  const c = letraColumna(col)
  return filaIni === filaFin ? `$${c}$${filaIni}` : `$${c}$${filaIni}:$${c}$${filaFin}`
}

const relleno = (hex: string) => `<a:solidFill><a:srgbClr val="${hex}"/></a:solidFill>`

function strCache(valores: string[]): string {
  return `<c:strCache><c:ptCount val="${valores.length}"/>${valores
    .map((v, i) => `<c:pt idx="${i}"><c:v>${xml(v)}</c:v></c:pt>`).join('')}</c:strCache>`
}

function numCache(valores: Array<number | null>, formato: string): string {
  return `<c:numCache><c:formatCode>${xml(formato)}</c:formatCode><c:ptCount val="${valores.length}"/>${valores
    .map((v, i) => (v == null || !Number.isFinite(v) ? '' : `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`)).join('')}</c:numCache>`
}

function etiquetas(formato: string, mostrar: boolean): string {
  return `<c:dLbls><c:numFmt formatCode="${xml(formato)}" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>`
    + '<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900" b="1"><a:solidFill><a:srgbClr val="374151"/></a:solidFill></a:defRPr></a:pPr><a:endParaRPr lang="es-CO"/></a:p></c:txPr>'
    + `<c:showLegendKey val="0"/><c:showVal val="${mostrar ? 1 : 0}"/><c:showCatName val="0"/><c:showSerName val="0"/>`
    + '<c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>'
}

const textoEje = '<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900"><a:solidFill><a:srgbClr val="4B5563"/></a:solidFill></a:defRPr></a:pPr><a:endParaRPr lang="es-CO"/></a:p></c:txPr>'
const sinLinea = '<c:spPr><a:ln><a:noFill/></a:ln></c:spPr>'
const lineaEje = '<c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="D1D5DB"/></a:solidFill></a:ln></c:spPr>'
const rejilla = '<c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="E5E7EB"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>'

/** El XML de un gráfico (chartSpace completo). */
export function xmlGrafico(g: GraficoXlsx): string {
  // Con el separador regional, '#,##0.##' deja '35,' en los enteros: enteros o un decimal.
  const conDecimales = g.series.some((s) => s.valores.some((v) => v != null && !Number.isInteger(v)))
  const formato = g.formato ?? (conDecimales ? '#,##0.0' : '#,##0')
  const horizontal = g.tipo !== 'linea'
  const variasSeries = g.series.length > 1
  const pocosPuntos = g.categorias.valores.length <= 31
  const cat = `<c:cat><c:strRef><c:f>${xml(g.categorias.ref)}</c:f>${strCache(g.categorias.valores)}</c:strRef></c:cat>`

  const series = g.series.map((s, i) => {
    const tx = `<c:tx><c:strRef><c:f>${xml(s.nombreRef)}</c:f>${strCache([s.nombre])}</c:strRef></c:tx>`
    const val = `<c:val><c:numRef><c:f>${xml(s.ref)}</c:f>${numCache(s.valores, formato)}</c:numRef></c:val>`
    if (g.tipo === 'linea') {
      return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${tx}`
        + `<c:spPr><a:ln w="22225" cap="rnd">${relleno(s.color)}<a:round/></a:ln></c:spPr>`
        + `<c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr>${relleno(s.color)}<a:ln w="9525"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr></c:marker>`
        + `${etiquetas(formato, !variasSeries && pocosPuntos)}${cat}${val}<c:smooth val="0"/></c:ser>`
    }
    const puntos = (s.colores ?? [])
      .map((c, k) => (c ? `<c:dPt><c:idx val="${k}"/><c:invertIfNegative val="0"/><c:bubble3D val="0"/><c:spPr>${relleno(c)}</c:spPr></c:dPt>` : ''))
      .join('')
    return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${tx}<c:spPr>${relleno(s.color)}</c:spPr>`
      + `<c:invertIfNegative val="0"/>${puntos}${etiquetas(formato, g.tipo === 'barras')}${cat}${val}</c:ser>`
  }).join('')

  const ejes = horizontal
    // Barras horizontales: la primera categoría arriba (eje invertido) y el de valores abajo.
    ? `<c:catAx><c:axId val="5001"/><c:scaling><c:orientation val="maxMin"/></c:scaling><c:delete val="0"/><c:axPos val="l"/>`
      + `<c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>${lineaEje}${textoEje}`
      + `<c:crossAx val="5002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>`
      + `<c:valAx><c:axId val="5002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/>${rejilla}`
      + `<c:numFmt formatCode="${xml(formato)}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>${sinLinea}${textoEje}`
      + `<c:crossAx val="5001"/><c:crosses val="max"/><c:crossBetween val="between"/></c:valAx>`
    : `<c:catAx><c:axId val="5001"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/>`
      + `<c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>${lineaEje}${textoEje}`
      + `<c:crossAx val="5002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>`
      + `<c:valAx><c:axId val="5002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/>${rejilla}`
      + `<c:numFmt formatCode="${xml(formato)}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>${sinLinea}${textoEje}`
      + `<c:crossAx val="5001"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`

  const cuerpo = g.tipo === 'linea'
    ? `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${series}<c:marker val="1"/><c:axId val="5001"/><c:axId val="5002"/></c:lineChart>`
    : `<c:barChart><c:barDir val="bar"/><c:grouping val="${g.tipo === 'apiladas' ? 'stacked' : 'clustered'}"/><c:varyColors val="0"/>${series}`
      + `<c:gapWidth val="60"/>${g.tipo === 'apiladas' ? '<c:overlap val="100"/>' : ''}<c:axId val="5001"/><c:axId val="5002"/></c:barChart>`

  const leyenda = variasSeries
    ? `<c:legend><c:legendPos val="b"/><c:overlay val="0"/>${textoEje}</c:legend>`
    : ''

  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + '<c:roundedCorners val="0"/><c:chart>'
    + `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="1"/></a:pPr><a:r><a:rPr lang="es-CO" sz="1200" b="1"><a:solidFill><a:srgbClr val="111827"/></a:solidFill></a:rPr><a:t>${xml(g.titulo)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`
    + '<c:autoTitleDeleted val="0"/>'
    + `<c:plotArea><c:layout/>${cuerpo}${ejes}<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr></c:plotArea>`
    + `${leyenda}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>`
    + '<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="E5E7EB"/></a:solidFill></a:ln></c:spPr>'
    + '<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr><a:latin typeface="Calibri"/></a:defRPr></a:pPr><a:endParaRPr lang="es-CO"/></a:p></c:txPr>'
    + '</c:chartSpace>'
}

function xmlDibujo(graficos: GraficoXlsx[], primerRel: number): string {
  const EMU = 9525 // por píxel
  const anclas = graficos.map((g, i) => '<xdr:oneCellAnchor>'
    + `<xdr:from><xdr:col>${g.desde.col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${g.desde.fila}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>`
    + `<xdr:ext cx="${Math.round(g.tamano.ancho * EMU)}" cy="${Math.round(g.tamano.alto * EMU)}"/>`
    + `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="${xml(`Gráfico ${i + 1}`)}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>`
    + '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>'
    + `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart r:id="rId${primerRel + i}"/></a:graphicData></a:graphic>`
    + '</xdr:graphicFrame><xdr:clientData/></xdr:oneCellAnchor>').join('')
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">'
    + `${anclas}</xdr:wsDr>`
}

const relsVacio = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'

/** Agrega una relación y devuelve su Id (rIdN libre). */
function agregarRelacion(rels: string, tipo: string, destino: string): { rels: string; id: string } {
  const usados = [...rels.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]))
  const id = `rId${Math.max(0, ...usados) + 1}`
  return { rels: rels.replace('</Relationships>', `<Relationship Id="${id}" Type="${tipo}" Target="${destino}"/></Relationships>`), id }
}

/**
 * Agrega los gráficos al libro. Devuelve el .xlsx nuevo. Las hojas se buscan
 * por nombre en xl/workbook.xml (exceljs las escribe como sheetN.xml).
 */
export async function agregarGraficos(buffer: ArrayBuffer, graficos: GraficoXlsx[]): Promise<ArrayBuffer> {
  if (!graficos.length) return buffer
  const modulo = await import('jszip')
  // En el navegador llega como `default`; cargado desde los tests, como el módulo mismo.
  const JSZip = (modulo as unknown as { default?: typeof modulo }).default ?? modulo
  const zip = await JSZip.loadAsync(buffer)
  const leer = async (ruta: string) => (await zip.file(ruta)?.async('string')) ?? null

  const libro = (await leer('xl/workbook.xml'))!
  const relsLibro = (await leer('xl/_rels/workbook.xml.rels'))!
  const destinoDeHoja = new Map<string, string>()
  for (const m of libro.matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
    const nombre = m[1]!.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'")
    const rel = relsLibro.match(new RegExp(`<Relationship [^>]*Id="${m[2]}"[^>]*Target="([^"]+)"`))
      ?? relsLibro.match(new RegExp(`<Relationship [^>]*Target="([^"]+)"[^>]*Id="${m[2]}"`))
    if (rel) destinoDeHoja.set(nombre, `xl/${rel[1]!.replace(/^\/?xl\//, '')}`)
  }

  let tipos = (await leer('[Content_Types].xml'))!
  const existentes = Object.keys(zip.files)
  let nDibujo = existentes.filter((f) => /^xl\/drawings\/drawing\d+\.xml$/.test(f)).length
  let nGrafico = existentes.filter((f) => /^xl\/charts\/chart\d+\.xml$/.test(f)).length

  const porHoja = new Map<string, GraficoXlsx[]>()
  for (const g of graficos) porHoja.set(g.hoja, [...(porHoja.get(g.hoja) ?? []), g])

  for (const [hoja, lista] of porHoja) {
    const rutaHoja = destinoDeHoja.get(hoja)
    if (!rutaHoja) continue
    let xmlHoja = (await leer(rutaHoja))!
    if (xmlHoja.includes('<drawing ')) continue // ya tiene un dibujo: no se toca

    nDibujo++
    const rutaDibujo = `xl/drawings/drawing${nDibujo}.xml`
    let relsDibujo = relsVacio
    for (const g of lista) {
      nGrafico++
      zip.file(`xl/charts/chart${nGrafico}.xml`, xmlGrafico(g))
      tipos = tipos.replace('</Types>', `<Override PartName="/xl/charts/chart${nGrafico}.xml" ContentType="${CT_CHART}"/></Types>`)
      relsDibujo = agregarRelacion(relsDibujo, REL_CHART, `../charts/chart${nGrafico}.xml`).rels
    }
    // Las relaciones del dibujo quedan rId1..rIdN en el mismo orden de las anclas.
    zip.file(rutaDibujo, xmlDibujo(lista, 1))
    zip.file(`xl/drawings/_rels/drawing${nDibujo}.xml.rels`, relsDibujo)
    tipos = tipos.replace('</Types>', `<Override PartName="/${rutaDibujo}" ContentType="${CT_DRAWING}"/></Types>`)

    const partes = rutaHoja.split('/')
    const rutaRelsHoja = `${partes.slice(0, -1).join('/')}/_rels/${partes[partes.length - 1]}.rels`
    const { rels, id } = agregarRelacion((await leer(rutaRelsHoja)) ?? relsVacio, REL_DRAWING, `../drawings/drawing${nDibujo}.xml`)
    zip.file(rutaRelsHoja, rels)

    if (!/xmlns:r="/.test(xmlHoja.slice(0, 600))) xmlHoja = xmlHoja.replace('<worksheet ', `<worksheet xmlns:r="${NS_REL}" `)
    // <drawing> va antes de <legacyDrawing>, <tableParts> y <extLst> (orden del esquema).
    const etiqueta = `<drawing r:id="${id}"/>`
    const antes = ['<legacyDrawing', '<legacyDrawingHF', '<picture', '<oleObjects', '<controls', '<webPublishItems', '<tableParts', '<extLst']
      .map((t) => xmlHoja.indexOf(t)).filter((i) => i >= 0)
    const pos = antes.length ? Math.min(...antes) : xmlHoja.lastIndexOf('</worksheet>')
    xmlHoja = xmlHoja.slice(0, pos) + etiqueta + xmlHoja.slice(pos)
    zip.file(rutaHoja, xmlHoja)
  }
  zip.file('[Content_Types].xml', tipos)
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })
}
