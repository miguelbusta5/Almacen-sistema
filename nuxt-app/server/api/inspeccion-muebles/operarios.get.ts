import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireInspeccion } from '../../utils/muebles'

/**
 * GET /api/inspeccion-muebles/operarios - a quien puede pedirle el inspector la
 * reposicion de un PLU averiado.
 *
 * Solo nombre e id: el inspector elige de una lista, no gestiona usuarios.
 */
export default defineEventHandler(async (event) => {
  await requireInspeccion(event)
  const operarios = await prisma.user.findMany({
    where: { role: 'PICKING_MUEBLES', active: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
  return { success: true, data: operarios.map((o) => ({ id: o.id, nombre: o.name })) }
})
