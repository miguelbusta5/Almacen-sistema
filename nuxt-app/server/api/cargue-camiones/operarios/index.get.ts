import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireCargue } from '../../../utils/cargueCamion'

/**
 * GET /api/cargue-camiones/operarios - quienes cargan (catalogo). Con
 * ?todos=1 tambien los inactivos (para la administracion del catalogo).
 */
export default defineEventHandler(async (event) => {
  await requireCargue(event)
  const todos = getQuery(event).todos === '1'
  const lista = await prisma.operarioCargue.findMany({
    where: todos ? {} : { activo: true },
    select: { id: true, nombre: true, activo: true },
    orderBy: { nombre: 'asc' },
  })
  return { success: true, data: lista }
})
