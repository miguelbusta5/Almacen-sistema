export interface ProductoMaestroDTO {
  plu: string;
  descripcion: string | null;
  fabricante: string | null;
  precio: number | null;
  marca: string | null;
}

export interface ProductoMaestroRow {
  plu?: unknown;
  PLU?: unknown;
  descripcion?: unknown;
  DESCRIPCION?: unknown;
  Fabricante?: unknown;
  fabricante?: unknown;
  PRECIO?: unknown;
  precio?: unknown;
  MARCAS?: unknown;
  marcas?: unknown;
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

export function mapExcelProductoRow(row: ProductoMaestroRow): ProductoMaestroDTO | null {
  const plu = normalizePlu(row.PLU ?? row.plu);
  if (!plu) return null;
  return {
    plu,
    descripcion: nullableText(row.DESCRIPCION ?? row.descripcion),
    fabricante: nullableText(row.Fabricante ?? row.fabricante),
    precio: parsePrecio(row.PRECIO ?? row.precio),
    marca: nullableText(row.MARCAS ?? row.marcas),
  };
}

export function productoToClient(producto: {
  plu: string;
  descripcion: string | null;
  fabricante: string | null;
  precio: unknown | null;
  marca: string | null;
}): ProductoMaestroDTO {
  return {
    plu: producto.plu,
    descripcion: producto.descripcion,
    fabricante: producto.fabricante,
    precio: producto.precio == null ? null : Number(producto.precio),
    marca: producto.marca,
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
