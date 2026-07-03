import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { normalizePlu, productoToClient } from '../../utils/productosMaestro'

// GET /api/productos-maestro/[plu]
export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const plu = getRouterParam(event, 'plu')!
  const normalized = normalizePlu(decodeURIComponent(plu))
  if (!normalized) throw createError({ statusCode: 400, statusMessage: 'PLU requerido' })

  const producto = await prisma.productoMaestro.findUnique({
    where: { plu: normalized },
    select: { plu: true, descripcion: true, fabricante: true, precio: true, marca: true },
  })
  if (!producto) throw createError({ statusCode: 404, statusMessage: 'PLU no encontrado en maestro' })

  return { success: true, data: productoToClient(producto) }
})
