import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'

// GET /api/tienda/conteos — totales por estado para el KpiRail,
// independientes de la paginación/filtros de la lista.
export default defineEventHandler(async (event) => {
  await requireAuth(event)

  const porEstado = await prisma.despachoTienda.groupBy({ by: ['estado'], _count: { estado: true } })
  const count = (estado: string) => porEstado.find((g) => g.estado === estado)?._count.estado ?? 0
  const total = porEstado.reduce((sum, g) => sum + g._count.estado, 0)

  return {
    success: true,
    data: {
      total,
      pendRecogida: count('CREADO_TIENDA'),
      enTransito: count('RECOGIDO_TIENDA') + count('ENTREGADO_CEDI'),
      completados: count('ENVIADO_CLIENTE'),
      atencion: count('CON_NOVEDAD') + count('RECHAZADO'),
    },
  }
})
