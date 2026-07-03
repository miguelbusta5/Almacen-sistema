// Portado 1:1 desde src/lib/productosMaestro.ts (solo lo que usa el servidor).
export interface ProductoMaestroDTO {
  plu: string
  descripcion: string | null
  fabricante: string | null
  precio: number | null
  marca: string | null
}

export function normalizePlu(value: unknown): string {
  return String(value ?? '').trim().toUpperCase()
}

export function productoToClient(producto: {
  plu: string
  descripcion: string | null
  fabricante: string | null
  precio: unknown | null
  marca: string | null
}): ProductoMaestroDTO {
  return {
    plu: producto.plu,
    descripcion: producto.descripcion,
    fabricante: producto.fabricante,
    precio: producto.precio == null ? null : Number(producto.precio),
    marca: producto.marca,
  }
}

export function derivePlinFromMaestro<T extends { descripcion?: string | null }>(
  data: T,
  producto: ProductoMaestroDTO | null,
  isAdmin: boolean,
): T {
  if (!producto) return data
  if (isAdmin) return data
  return { ...data, descripcion: producto.descripcion }
}
