import { defineEventHandler, getQuery, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { normalizarCodigoProducto, pareceEan } from '../../utils/montacargasCalc'
import { pluDesdeEanAmbiente } from '../../utils/mueblesCalc'

// GET /api/productos-maestro/buscar?codigo=… — resuelve por PLU **o** por EAN.
// Existe aparte de [plu].get.ts porque la pistola del montacarguista lee el
// código de barras y ese endpoint solo busca por PLU (y lo consumen ya
// Exportaciones, Tienda y Solicitudes: no conviene cambiarle el contrato).
export default defineEventHandler(async (event) => {
  await requireAuth(event)

  const codigo = normalizarCodigoProducto(getQuery(event).codigo)
  if (!codigo) throw createError({ statusCode: 400, statusMessage: 'Código requerido' })

  const select = {
    plu: true,
    ean: true,
    descripcion: true,
    unidadesPorCaja: true,
    fabricante: true,
    marca: true,
  }
  const porPlu = () => prisma.productoMaestro.findUnique({ where: { plu: codigo }, select })
  // findFirst: el EAN no es único en el maestro.
  const porEan = () => prisma.productoMaestro.findFirst({ where: { ean: codigo }, select })

  const [primero, segundo] = pareceEan(codigo) ? [porEan, porPlu] : [porPlu, porEan]
  const derivado = pluDesdeEanAmbiente(codigo)
  // Producto nuevo sin el EAN cargado: el PLU va dentro del codigo de barras.
  const producto = (await primero()) ?? (await segundo())
    ?? (derivado ? await prisma.productoMaestro.findUnique({ where: { plu: derivado }, select }) : null)

  if (!producto) {
    throw createError({ statusCode: 404, statusMessage: 'Código no encontrado en el maestro' })
  }

  return { success: true, data: producto }
})
