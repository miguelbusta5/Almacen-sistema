import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { calcCostoAlmacenaje, tieneAlertaEntrega } from '../../utils/almacenaje'

// GET /api/transporte/conteos — totales para el KpiRail, independientes
// de la paginación/filtros de la lista. `alertas`/`costo` dependen de
// datos por fila (fecha de ingreso + nota de entrega comprometida) — se
// calculan solo sobre los guardados activos (PENDIENTE DESPACHO, ya
// indexado por estado), no sobre todo el histórico.
export default defineEventHandler(async (event) => {
  await requireAuth(event)

  const porEstado = await prisma.transporteGuardado.groupBy({ by: ['estado'], _count: { estado: true } })
  const total = porEstado.reduce((s, g) => s + g._count.estado, 0)
  const pend = porEstado.find((g) => g.estado === 'PENDIENTE DESPACHO')?._count.estado ?? 0
  const desp = porEstado.find((g) => g.estado === 'DESPACHADO')?._count.estado ?? 0

  const activos = await prisma.transporteGuardado.findMany({
    where: { estado: 'PENDIENTE DESPACHO' },
    select: { fecha: true, nota: true },
  })
  let alertas = 0
  let costo = 0
  for (const g of activos) {
    if (tieneAlertaEntrega(g.nota)) alertas++
    costo += calcCostoAlmacenaje(g.fecha.toISOString().slice(0, 10), null)
  }

  return { success: true, data: { total, pend, desp, alertas, costo } }
})
