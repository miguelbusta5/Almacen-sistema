export interface ProductoPvp {
  plu: string
  descripcion: string
  proveedor: string
  upc: string
  precio: number | null
  marca: string
  linea: string
}

const texto = (v: unknown) => v == null ? '' : String(v).trim()
const encabezado = (v: unknown) => texto(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** No usa el maestro de empaque: el PVP pertenece a cada cronograma. */
export function leerMaestroPvp(rows: unknown[][]) {
  if (rows.length < 2 || rows.length > 50001) throw new Error('El maestro debe tener entre 1 y 50.000 productos')
  const headers = (rows[0] ?? []).map(encabezado)
  const requeridos = ['referencia original', 'nombre para mostrar', 'fabricante', 'codigo upc', 'precio unitario', 'marcas', 'grupo']
  const indices = requeridos.map(h => {
    if (headers.filter(x => x === h).length !== 1) throw new Error(`Encabezado faltante o repetido: ${h}`)
    return headers.indexOf(h)
  })
  const productos = new Map<string, ProductoPvp>()
  const sinPlu: { fila: number; descripcion: string }[] = []
  let repetidos = 0
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!
    if (!row.some(v => texto(v))) continue
    const [plu, descripcion, proveedor, upc, rawPrecio, marca, linea] = indices.map(index => row[index])
    const id = texto(plu).toUpperCase()
    if (!id) { sinPlu.push({ fila: i + 1, descripcion: texto(descripcion) }); continue }
    if (id.length > 100) throw new Error(`Fila ${i + 1}: PLU demasiado largo`)
    if (typeof plu === 'number' && !Number.isSafeInteger(plu)) throw new Error(`Fila ${i + 1}: PLU numérico inválido`)
    if (typeof upc === 'number' && (!Number.isSafeInteger(upc) || upc < 0)) throw new Error(`Fila ${i + 1}: UPC inválido; guárdalo como texto`)
    const precio = texto(rawPrecio) === '' ? null : Number(rawPrecio)
    if (precio !== null && (!Number.isFinite(precio) || precio < 0 || precio > 9999999999.99)) throw new Error(`Fila ${i + 1}: precio inválido; usa una celda numérica`)
    const producto: ProductoPvp = { plu: id, descripcion: texto(descripcion), proveedor: texto(proveedor), upc: texto(upc), precio: precio === null ? null : Math.round(precio * 100) / 100, marca: texto(marca), linea: texto(linea) }
    if (producto.upc.length > 50 || [producto.descripcion, producto.proveedor, producto.marca, producto.linea].some(s => s.length > 500)) throw new Error(`Fila ${i + 1}: texto demasiado largo`)
    const anterior = productos.get(id)
    if (anterior) {
      if (JSON.stringify(anterior) !== JSON.stringify(producto)) throw new Error(`PLU ${id} repetido con datos diferentes; corrige el archivo`)
      repetidos++
    } else productos.set(id, producto)
  }
  if (!productos.size) throw new Error('El maestro no contiene productos')
  const lista = [...productos.values()]
  const codigos = new Map<string, number>()
  for (const p of lista) if (p.upc) codigos.set(p.upc, (codigos.get(p.upc) ?? 0) + 1)
  return { productos: lista, resumen: { total: lista.length, repetidos, sinPlu, sinDescripcion: lista.filter(p => !p.descripcion).length, sinUpc: lista.filter(p => !p.upc).length, sinPrecio: lista.filter(p => p.precio === null).length, upcCompartidos: [...codigos.values()].filter(n => n > 1).length } }
}

export function fechasCronograma(inicio: string, dias: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !Number.isInteger(dias) || dias < 1 || dias > 366) throw new Error('Indica fecha inicial y duración entre 1 y 366 días')
  const fechaInicio = new Date(`${inicio}T00:00:00.000Z`)
  if (!Number.isFinite(fechaInicio.getTime()) || fechaInicio.toISOString().slice(0, 10) !== inicio) throw new Error('Fecha inicial inválida')
  const fechaFin = new Date(fechaInicio.getTime() + (dias - 1) * 86400000)
  return { fechaInicio, fechaFin }
}
