// Nombre de hoja compartido entre importación y exportación: si se desalinean,
// el importar()/route.ts no encuentra la hoja y cae al primer worksheet del
// archivo, lo que rompe el roundtrip export -> editar -> import.
export const MAESTRO_SHEET_NAME = "ResultadosMaestrodeproductosPV";

// Hojas aceptadas al importar, en orden de preferencia. La planilla de
// montacargas trae su catálogo en "MAESTRO REF"; sin esta lista el importador
// caía a worksheets[0], que en ese archivo es la pestaña de un operario y no el
// maestro.
export const MAESTRO_SHEET_NAMES = [MAESTRO_SHEET_NAME, "MAESTRO REF"] as const;

export interface ProductoMaestroDTO {
  plu: string;
  descripcion: string | null;
  fabricante: string | null;
  precio: number | null;
  marca: string | null;
  ean: string | null;
  unidadesPorCaja: number | null;
}

export interface ProductoMaestroRow {
  plu?: unknown;
  PLU?: unknown;
  "Referencia Original"?: unknown;
  descripcion?: unknown;
  DESCRIPCION?: unknown;
  "Nombre para mostrar"?: unknown;
  Fabricante?: unknown;
  fabricante?: unknown;
  PRECIO?: unknown;
  precio?: unknown;
  "Precio unitario"?: unknown;
  MARCAS?: unknown;
  marcas?: unknown;
  EAN?: unknown;
  ean?: unknown;
  // "Und Emp" en el maestro de montacargas — en el archivo real el encabezado
  // lleva un salto de línea en medio, por eso se busca con headerValue().
  "Und Emp"?: unknown;
  unidadesPorCaja?: unknown;
  // worksheetObjects() devuelve una clave por encabezado del Excel, y el maestro
  // de montacargas trae 17. Las propiedades de arriba documentan las que se
  // consumen; esta firma refleja que el resto también llega.
  [header: string]: unknown;
}

// Los encabezados del Excel llegan tal cual: el maestro trae "Und" y "Emp"
// separados por un salto de línea dentro de la celda, y worksheetObjects() solo
// hace trim (no colapsa el salto interno). Se compara contra una version
// normalizada de cada clave.
function headerValue(row: ProductoMaestroRow, ...names: string[]): unknown {
  const wanted = names.map((n) => n.toLowerCase().replace(/\s+/g, " ").trim());
  for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
    if (wanted.includes(key.toLowerCase().replace(/\s+/g, " ").trim())) {
      if (value !== null && value !== undefined && value !== "") return value;
    }
  }
  return undefined;
}

export function normalizePlu(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

export function nullableText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

export function parsePrecio(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = String(value)
    .trim()
    .replace(/\$/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

// Entero no negativo o null. Tolera decimales de Excel ("24.0") y celdas vacías.
// El 0 se trata como "sin dato": en el maestro las unidades por caja en 0 son
// filas sin diligenciar, no cajas de cero unidades.
export function parseEntero(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).trim().replace(",", "."));
  if (!Number.isFinite(parsed)) return null;
  const entero = Math.round(parsed);
  return entero > 0 ? entero : null;
}

// El EAN es un código, no un número: Excel lo puede entregar como number y
// perdería el formato. Se normaliza a dígitos.
export function parseEan(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = typeof value === "number" ? String(Math.round(value)) : String(value).trim();
  const digits = text.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 20 ? digits : null;
}

// Encabezados que alimentan cada columna de productos_maestro. `plu` no está:
// es la clave del upsert, nunca se "actualiza".
const COLUMNA_HEADERS: Record<string, string[]> = {
  descripcion: ["DESCRIPCION", "descripcion", "Nombre para mostrar"],
  fabricante: ["Fabricante", "fabricante"],
  precio: ["PRECIO", "precio", "Precio unitario"],
  marca: ["MARCAS", "marcas"],
  ean: ["EAN"],
  unidades_por_caja: ["Und Emp", "unidadesPorCaja", "UNIDADES X CAJA"],
};

/**
 * Columnas de productos_maestro que el archivo realmente trae, mirando los
 * encabezados y no los valores (una columna presente pero vacía en todas las
 * filas SÍ debe poder vaciar el campo: es como se borra un dato a propósito).
 *
 * Existe porque ahora dos archivos distintos alimentan la misma tabla: el
 * maestro de precios (con Fabricante/PRECIO/MARCAS) y la planilla de
 * montacargas (con EAN/Und Emp). Sin esto, importar uno vaciaba las columnas
 * del otro en los ~19k productos.
 */
export function columnasPresentes(rows: ProductoMaestroRow[]): string[] {
  const headers = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row as Record<string, unknown>)) {
      headers.add(key.toLowerCase().replace(/\s+/g, " ").trim());
    }
  }
  return Object.entries(COLUMNA_HEADERS)
    .filter(([, alias]) =>
      alias.some((a) => headers.has(a.toLowerCase().replace(/\s+/g, " ").trim()))
    )
    .map(([columna]) => columna);
}

export function mapExcelProductoRow(row: ProductoMaestroRow): ProductoMaestroDTO | null {
  const plu = normalizePlu(row.PLU ?? row.plu ?? row["Referencia Original"]);
  if (!plu) return null;
  return {
    plu,
    descripcion: nullableText(row.DESCRIPCION ?? row.descripcion ?? row["Nombre para mostrar"]),
    fabricante: nullableText(row.Fabricante ?? row.fabricante),
    precio: parsePrecio(row.PRECIO ?? row.precio ?? row["Precio unitario"]),
    marca: nullableText(row.MARCAS ?? row.marcas),
    ean: parseEan(headerValue(row, "EAN")),
    unidadesPorCaja: parseEntero(headerValue(row, "Und Emp", "unidadesPorCaja", "UNIDADES X CAJA")),
  };
}

export function productoToClient(producto: {
  plu: string;
  descripcion: string | null;
  fabricante: string | null;
  precio: unknown | null;
  marca: string | null;
  ean?: string | null;
  unidadesPorCaja?: number | null;
}): ProductoMaestroDTO {
  return {
    plu: producto.plu,
    descripcion: producto.descripcion,
    fabricante: producto.fabricante,
    precio: producto.precio == null ? null : Number(producto.precio),
    marca: producto.marca,
    ean: producto.ean ?? null,
    unidadesPorCaja: producto.unidadesPorCaja ?? null,
  };
}

export function deriveNovedadFromMaestro<T extends {
  descripcion?: string | null;
  fabricante?: string | null;
  costoUnitario?: number | null;
}>(
  data: T,
  producto: ProductoMaestroDTO | null,
  isAdmin: boolean
): T {
  if (!producto) return data;
  if (isAdmin) return data;
  return {
    ...data,
    descripcion: producto.descripcion,
    fabricante: producto.fabricante,
    costoUnitario: producto.precio == null ? null : Math.round(producto.precio),
  };
}

export function derivePlinFromMaestro<T extends { descripcion?: string | null }>(
  data: T,
  producto: ProductoMaestroDTO | null,
  isAdmin: boolean
): T {
  if (!producto) return data;
  if (isAdmin) return data;
  return {
    ...data,
    descripcion: producto.descripcion,
  };
}
