// Lectura de la hoja MEDICION: los pesos y medidas de la caja master.
//
// Va aparte de productosMaestro.ts porque el archivo tiene una cabecera de DOS
// niveles (fila 1 combinada, fila 2 con el subencabezado) y ahi los encabezados
// se repiten: "PARTE 1 PESO CAJA MASTER (KG)" cubre PB y PN. worksheetObjects()
// solo mira la fila 1, asi que colapsaria esas columnas — por eso se lee con
// worksheetRows() y se combinan las dos filas.
import type { ExcelRow } from "./excel";
import { normalizePlu } from "./productosMaestro";

export interface MedidaParte {
  parte: number;
  pesoBrutoKg: number | null;
  pesoNetoKg: number | null;
  altoCm: number | null;
  anchoCm: number | null;
  profCm: number | null;
  volumenM3: number | null;
}

export interface MedidasDimensiones {
  altoCm: number | null;
  anchoCm: number | null;
  profCm: number | null;
}

export interface MedicionProducto {
  plu: string;
  descripcion: string | null;
  zona: string | null;
  partes: number | null;
  unidadesPorCaja: number | null;
  unidadesSet: number | null;
  subEmpaque: number | null;
  empaque: MedidasDimensiones;
  pieza: MedidasDimensiones;
  cajas: MedidaParte[];
}

// Mismo criterio que mapExcelProductoRow: estas filas no son productos reales.
const DESCRIPCION_MARCADOR = /^plu no existe/i;

function texto(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.result === "string" || typeof obj.result === "number") {
      return String(obj.result);
    }
    if (typeof obj.text === "string") return obj.text;
    return "";
  }
  return String(value).trim();
}

/** Colapsa el salto de linea que traen encabezados como "Und\nEmp". */
function normalizar(value: unknown): string {
  return texto(value).replace(/\s+/g, " ").trim().toUpperCase();
}

export function parseDecimal(value: unknown): number | null {
  const raw = texto(value);
  if (!raw) return null;
  // El archivo mezcla coma y punto decimal segun quien haya escrito la fila.
  const n = typeof value === "number" ? value : Number(raw.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return n;
}

function parseEnteroPositivo(value: unknown): number | null {
  const n = parseDecimal(value);
  if (n === null) return null;
  const entero = Math.trunc(n);
  return entero > 0 ? entero : null;
}

export interface MedicionCabecera {
  /** Solo la fila 1: donde se nombran las columnas de identidad (PLU, ZONA...). */
  nivel1: string[];
  /** Fila 1 + fila 2: lo unico que distingue el PB del PN de una misma parte. */
  combinado: string[];
}

/**
 * Lee la cabecera de dos niveles.
 *
 * ExcelJS rellena las celdas combinadas con el valor de la celda maestra, asi
 * que la fila 1 ya viene repetida a lo ancho de cada bloque; pegarle la fila 2
 * es lo que separa "PARTE 1 ... PB" de "PARTE 1 ... PN".
 *
 * Se devuelven los dos niveles y no solo el combinado porque la fila 2 tambien
 * trae basura bajo las columnas de identidad — en el archivo real hay un 0 bajo
 * PLU, que convertiria esa clave en "PLU 0".
 */
export function medicionHeaders(fila1: ExcelRow, fila2: ExcelRow): MedicionCabecera {
  const ancho = Math.max(fila1.length, fila2.length);
  const nivel1: string[] = [];
  const combinado: string[] = [];
  for (let i = 0; i < ancho; i += 1) {
    const arriba = normalizar(fila1[i]);
    const abajo = normalizar(fila2[i]);
    nivel1.push(arriba);
    combinado.push(arriba && abajo ? `${arriba} ${abajo}` : arriba || abajo);
  }
  return { nivel1, combinado };
}

/**
 * Indice de la primera columna cuyo encabezado cumple el predicado, o -1.
 *
 * Todo se localiza por encabezado y nunca por posicion: el archivo tiene 78
 * columnas y ya ha cambiado de forma entre versiones. Si llega una V3 con las
 * columnas movidas o con una PARTE 6, esto sigue funcionando.
 */
function buscar(headers: string[], test: (h: string) => boolean): number {
  return headers.findIndex((h) => h && test(h));
}

function columnaExacta(headers: string[], ...nombres: string[]): number {
  const buscados = nombres.map((n) => n.toUpperCase());
  return buscar(headers, (h) => buscados.includes(h));
}

// Los bloques de parte: "PARTE 1 PESO CAJA MASTER (KG) PB" y
// "PARTE 1 MEDIDA CAJA MASTER (CM) ALTO".
const RE_PARTE = /^PARTE\s+(\d+)\s+(PESO|MEDIDA)\b.*\s(PB|PN|ALTO|ANCHO|PROF)$/;

interface ColumnasParte {
  parte: number;
  pb: number;
  pn: number;
  alto: number;
  ancho: number;
  prof: number;
}

function columnasDePartes(headers: string[]): ColumnasParte[] {
  const porParte = new Map<number, ColumnasParte>();
  headers.forEach((h, i) => {
    const m = RE_PARTE.exec(h ?? "");
    if (!m) return;
    const parte = Number(m[1]);
    const campo = m[3];
    const previo = porParte.get(parte) ?? {
      parte, pb: -1, pn: -1, alto: -1, ancho: -1, prof: -1,
    };
    if (campo === "PB") previo.pb = i;
    else if (campo === "PN") previo.pn = i;
    else if (campo === "ALTO") previo.alto = i;
    else if (campo === "ANCHO") previo.ancho = i;
    else previo.prof = i;
    porParte.set(parte, previo);
  });
  return [...porParte.values()].sort((a, b) => a.parte - b.parte);
}

// Bloques de medidas que NO son de la caja: el producto con su empaque y la
// pieza desnuda. Se localizan por el encabezado de la fila 1.
function columnasDeBloque(headers: string[], prefijo: string) {
  const col = (campo: string) =>
    buscar(headers, (h) => h.startsWith(prefijo) && h.endsWith(` ${campo}`));
  return { alto: col("ALTO"), ancho: col("ANCHO"), prof: col("PROF") };
}

function celda(row: ExcelRow, index: number): unknown {
  // Las filas llegan de largo variable: worksheetRows las dimensiona con
  // row.values.length, asi que una fila sin mediciones al final viene corta.
  if (index < 0 || index >= row.length) return null;
  return row[index] ?? null;
}

function dimensiones(row: ExcelRow, cols: { alto: number; ancho: number; prof: number }): MedidasDimensiones {
  return {
    altoCm: parseDecimal(celda(row, cols.alto)),
    anchoCm: parseDecimal(celda(row, cols.ancho)),
    profCm: parseDecimal(celda(row, cols.prof)),
  };
}

/** cm x cm x cm -> m3. Solo con las tres dimensiones: media caja no es un volumen. */
export function volumenM3(alto: number | null, ancho: number | null, prof: number | null): number | null {
  if (alto === null || ancho === null || prof === null) return null;
  return (alto * ancho * prof) / 1_000_000;
}

/**
 * Filas de la hoja MEDICION -> un registro por producto con sus cajas.
 *
 * `rows` es la salida cruda de worksheetRows(): [0] cabecera, [1] subcabecera,
 * el resto datos.
 */
export function mapMedicionRows(rows: ExcelRow[]): MedicionProducto[] {
  if (rows.length < 3) return [];

  const { nivel1, combinado } = medicionHeaders(rows[0], rows[1]);
  const cPlu = columnaExacta(nivel1, "PLU");
  if (cPlu < 0) return [];

  const cDescripcion = columnaExacta(nivel1, "DESCRIPCION");
  const cZona = columnaExacta(nivel1, "ZONA");
  const cPartes = buscar(nivel1, (h) => h.startsWith("PRODUCTO/") && h.includes("PARTES"));
  const cUndEmp = columnaExacta(nivel1, "UND EMP", "UNIDADES X CAJA");
  const cSet = columnaExacta(nivel1, "SET");
  const cSubEmp = columnaExacta(nivel1, "SUB EMP");
  const partes = columnasDePartes(combinado);
  const colsEmpaque = columnasDeBloque(combinado, "PRODUCTO CON EMPAQUE");
  const colsPieza = columnasDeBloque(combinado, "PRODUCTO PIEZA");

  // Por PLU: si el archivo lo repite, gana la ultima fila. Mismo criterio que
  // el importador del maestro, para que un archivo no se comporte distinto
  // segun por donde entre.
  const porPlu = new Map<string, MedicionProducto>();

  for (const row of rows.slice(2)) {
    const plu = normalizePlu(celda(row, cPlu));
    // "0" es la fila de subencabezados de las hojas con cabecera de dos
    // niveles, donde la columna PLU va en blanco o en cero.
    if (!plu || plu === "0") continue;

    const descripcion = texto(celda(row, cDescripcion)) || null;
    if (descripcion && DESCRIPCION_MARCADOR.test(descripcion)) continue;

    const cajas: MedidaParte[] = [];
    for (const p of partes) {
      const pesoBrutoKg = parseDecimal(celda(row, p.pb));
      const pesoNetoKg = parseDecimal(celda(row, p.pn));
      const altoCm = parseDecimal(celda(row, p.alto));
      const anchoCm = parseDecimal(celda(row, p.ancho));
      const profCm = parseDecimal(celda(row, p.prof));
      // Una parte existe si trae peso O alguna medida. Los bloques vacios son
      // la norma: solo 2 productos de 6.424 llegan a la parte 5.
      const medida = [pesoBrutoKg, pesoNetoKg, altoCm, anchoCm, profCm].some((v) => v !== null);
      if (!medida) continue;
      cajas.push({
        parte: p.parte,
        pesoBrutoKg,
        pesoNetoKg,
        altoCm,
        anchoCm,
        profCm,
        volumenM3: volumenM3(altoCm, anchoCm, profCm),
      });
    }

    porPlu.set(plu, {
      plu,
      descripcion,
      zona: texto(celda(row, cZona)) || null,
      partes: parseEnteroPositivo(celda(row, cPartes)),
      unidadesPorCaja: parseEnteroPositivo(celda(row, cUndEmp)),
      unidadesSet: parseEnteroPositivo(celda(row, cSet)),
      subEmpaque: parseEnteroPositivo(celda(row, cSubEmp)),
      empaque: dimensiones(row, colsEmpaque),
      pieza: dimensiones(row, colsPieza),
      cajas,
    });
  }

  return [...porPlu.values()];
}

/** ¿El archivo trae la cabecera de mediciones? Si no, no se tocan esas tablas. */
export function tieneColumnasDeMedicion(rows: ExcelRow[]): boolean {
  if (rows.length < 2) return false;
  const { nivel1, combinado } = medicionHeaders(rows[0], rows[1]);
  return columnaExacta(nivel1, "PLU") >= 0 && columnasDePartes(combinado).length > 0;
}
