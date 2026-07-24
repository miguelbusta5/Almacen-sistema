import { defineEventHandler, getQuery, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { canSeeIntegracion } from '../../utils/integracion'
import { mapIntegracion } from '../../utils/mapRow'

// GET /api/integracion?estado=&area=&tipoDocumento=&fechaDesde=&fechaHasta=&page=
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  if (!canSeeIntegracion(actor.role)) throw createError({ statusCode: 403, statusMessage: 'Sin acceso' })

  const sp = getQuery(event)
  const estado = sp.estado ? String(sp.estado) : undefined
  const area = sp.area ? String(sp.area) : undefined
  const tipoDocumento = sp.tipoDocumento ? String(sp.tipoDocumento) : undefined
  const fechaDesde = sp.fechaDesde ? String(sp.fechaDesde) : undefined
  const fechaHasta = sp.fechaHasta ? String(sp.fechaHasta) : undefined
  const page = Math.max(1, parseInt(String(sp.page ?? '1'), 10) || 1)
  const pageSize = 50

  const where: any = {}
  if (estado) where.estado = estado
  if (area) where.areaIniciadora = area
  if (tipoDocumento) where.tipoDocumento = tipoDocumento
  if (fechaDesde || fechaHasta) {
    where.fecha = {
      ...(fechaDesde ? { gte: new Date(fechaDesde) } : {}),
      ...(fechaHasta ? { lte: new Date(fechaHasta) } : {}),
    }
  }

  const [total, rows] = await Promise.all([
    prisma.integracionPedido.count({ where }),
    prisma.integracionPedido.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        creadoPor: { select: { name: true } },
        completadoPor: { select: { name: true } },
        plines: true,
      },
    }),
  ])

  return { success: true, data: rows.map(mapIntegracion), total, page, pageSize }
})
