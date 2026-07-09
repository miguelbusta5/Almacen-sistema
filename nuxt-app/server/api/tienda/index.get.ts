import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { mapDespacho } from '../../utils/mapRow'

// GET /api/tienda?page=1&pageSize=30&estado=&centroCostos=&q=&alerta=
export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const sp = getQuery(event)
  const page = Math.max(1, parseInt(String(sp.page ?? '1')) || 1)
  const pageSize = Math.min(200, Math.max(20, parseInt(String(sp.pageSize ?? '30')) || 30))
  const estado = String(sp.estado ?? '')
  const cc = String(sp.centroCostos ?? '')
  const q = String(sp.q ?? '').trim()
  const alerta = sp.alerta === '1' || sp.alerta === 'true'

  const where: any = {}
  const and: any[] = []
  if (estado) where.estado = estado
  if (cc) where.centroCostos = { contains: cc, mode: 'insensitive' }
  if (q) {
    and.push({
      OR: [
        { numeroDocumento: { contains: q, mode: 'insensitive' } },
        { clienteNombre: { contains: q, mode: 'insensitive' } },
        { consecutivo: { contains: q, mode: 'insensitive' } },
      ],
    })
  }
  if (alerta) {
    and.push({
      OR: [
        { estado: { in: ['CON_NOVEDAD', 'RECHAZADO'] } },
        { estado: 'CREADO_TIENDA', createdAt: { lt: new Date(Date.now() - 24 * 3_600_000) } },
      ],
    })
  }
  if (and.length) where.AND = and

  const [rows, total] = await prisma.$transaction([
    prisma.despachoTienda.findMany({
      where,
      include: { creadoPor: { select: { id: true, name: true } }, plines: true, guardadoPendiente: { include: { asignadoA: { select: { name: true } } } } },
      orderBy: [{ fechaCreacion: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.despachoTienda.count({ where }),
  ])

  return { success: true, data: rows.map(mapDespacho), total, page, pageSize }
})
