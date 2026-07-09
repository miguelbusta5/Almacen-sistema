import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'

// GET /api/tienda/centros-costos — valores distintos de centro de costos,
// para el select de filtro. `centroCostos` está indexado
// (@@index([centroCostos, fechaCreacion])), así que el distinct es barato
// aun con el histórico completo.
export default defineEventHandler(async (event) => {
  await requireAuth(event)

  const rows = await prisma.despachoTienda.findMany({
    select: { centroCostos: true },
    distinct: ['centroCostos'],
    orderBy: { centroCostos: 'asc' },
  })

  return { success: true, data: rows.map((r) => r.centroCostos).filter(Boolean) }
})
