import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'

const ROLES_VEN = ['ADMIN', 'GERENTE', 'OPERACIONES_GOURMET', 'TRANSPORTE', 'SUPERVISOR_TRANSPORTE']

// GET /api/cargue-gourmet/conteos — totales por estado para el KpiRail,
// independientes de la paginación/filtros de la lista (antes se calculaban
// en el cliente sobre las 500 filas cargadas, lo que además de ser
// costoso quedaba incompleto en cuanto la lista se pagina de verdad).
export default defineEventHandler(async (event) => {
  await requireRole(event, ROLES_VEN)

  const porEstado = await prisma.gourmetPedido.groupBy({ by: ['estado'], _count: { estado: true } })
  const count = (estado: string) => porEstado.find((g) => g.estado === estado)?._count.estado ?? 0
  const total = porEstado.reduce((sum, g) => sum + g._count.estado, 0)

  return {
    success: true,
    data: {
      total,
      sinUbicacion: count('BORRADOR'),
      enCargue: count('EN_CARGUE'),
      completados: count('CARGUE_COMPLETO') + count('CARGUE_COMPLETO_MANUAL'),
      novedad: count('CON_NOVEDAD'),
    },
  }
})
