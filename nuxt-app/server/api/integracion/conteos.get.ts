import { defineEventHandler, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { canSeeIntegracion } from '../../utils/integracion'

// GET /api/integracion/conteos — totales por estado para el KpiRail,
// independientes de la paginación/filtros de la lista.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  if (!canSeeIntegracion(actor.role)) throw createError({ statusCode: 403, statusMessage: 'Sin acceso' })

  const porEstado = await prisma.integracionPedido.groupBy({ by: ['estado'], _count: { estado: true } })
  const total = porEstado.reduce((s, g) => s + g._count.estado, 0)
  const pendienteArea2 = porEstado.find((g) => g.estado === 'PENDIENTE_AREA2')?._count.estado ?? 0
  const listaTransporte = porEstado.find((g) => g.estado === 'LISTA_TRANSPORTE')?._count.estado ?? 0
  const completada = porEstado.find((g) => g.estado === 'COMPLETADA')?._count.estado ?? 0

  return { success: true, data: { total, pendienteArea2, listaTransporte, completada } }
})
