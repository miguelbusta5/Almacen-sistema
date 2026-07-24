import { defineEventHandler, getQuery, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'

const ALLOWED = ['ADMIN', 'GERENTE', 'SUPERVISOR_TRANSPORTE']

// GET /api/preoperacional/historial — listado paginado (vista supervisor).
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  if (!ALLOWED.includes(actor.role)) throw createError({ statusCode: 403, statusMessage: 'No autorizado' })

  const sp = getQuery(event)
  const page = Math.max(1, Number(sp.page ?? 1))
  const pageSize = Math.min(200, Math.max(1, Number(sp.pageSize ?? 50)))
  const fechaDesde = sp.fechaDesde ? String(sp.fechaDesde) : undefined
  const fechaHasta = sp.fechaHasta ? String(sp.fechaHasta) : undefined
  const conductorId = sp.conductorId ? String(sp.conductorId) : undefined
  const estado = sp.estado ? String(sp.estado) : undefined

  const where: any = { vigente: true }
  const fechaFilter: any = {}
  if (fechaDesde) fechaFilter.gte = new Date(fechaDesde)
  if (fechaHasta) fechaFilter.lte = new Date(fechaHasta + 'T23:59:59Z')
  if (fechaDesde || fechaHasta) where.fecha = fechaFilter
  if (conductorId) where.conductorId = conductorId
  if (estado) where.estado = estado

  const [total, rows, conductores] = await Promise.all([
    prisma.inspeccionPreoperacional.count({ where }),
    prisma.inspeccionPreoperacional.findMany({
      where,
      select: {
        id: true,
        fecha: true,
        kilometraje: true,
        observaciones: true,
        estado: true,
        conductor: { select: { id: true, nombre: true, telefono: true } },
        vehiculo: { select: { id: true, placa: true, tipo: true } },
        _count: { select: { items: true } },
        items: { where: { resultado: 'NO_CONFORME' }, select: { esCritico: true } },
      },
      orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.transportista.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
  ])

  const data = rows.map((r) => ({
    id: r.id,
    fecha: r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : r.fecha,
    kilometraje: r.kilometraje ?? null,
    observaciones: r.observaciones ?? null,
    estado: r.estado,
    conductor: r.conductor,
    vehiculo: r.vehiculo,
    itemsCount: r._count.items,
    noConformes: r.items.length,
    criticos: r.items.filter((i) => i.esCritico).length,
  }))

  return {
    success: true,
    data,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    conductores,
  }
})
