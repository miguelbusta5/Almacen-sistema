import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { mapPedidoGourmet } from '../../utils/mapRow'

const ROLES_VEN = ['ADMIN', 'GERENTE', 'OPERACIONES_GOURMET', 'TRANSPORTE', 'SUPERVISOR_TRANSPORTE']

// GET /api/cargue-gourmet?page=1&pageSize=30&ciudad=&estado=&tienda=&tipoOrden=&q=&alerta=&estadoNot=
export default defineEventHandler(async (event) => {
  await requireRole(event, ROLES_VEN)
  const sp = getQuery(event)
  const page = Math.max(1, parseInt(String(sp.page ?? '1')) || 1)
  const pageSize = Math.min(200, Math.max(1, parseInt(String(sp.pageSize ?? '30')) || 30))
  const ciudad = String(sp.ciudad ?? '').trim()
  const estado = String(sp.estado ?? '').trim()
  const tienda = String(sp.tienda ?? '').trim()
  const tipoOrden = String(sp.tipoOrden ?? '').trim()
  const q = String(sp.q ?? '').trim()
  const alerta = sp.alerta === '1' || sp.alerta === 'true'
  // Usado solo por el modal de "Cargue masivo" para traer los pedidos aún
  // despachables (excluye los ya completados/cancelados) sin depender del
  // listado paginado de la pantalla principal.
  const estadoNot = String(sp.estadoNot ?? '').trim().split(',').map((s) => s.trim()).filter(Boolean)

  const where: any = {}
  const and: any[] = []
  if (ciudad) where.ciudadDestino = ciudad
  if (estado) where.estado = estado
  if (tienda) where.nombreTienda = tienda
  if (tipoOrden) where.tipoOrden = tipoOrden
  if (estadoNot.length) where.estado = { notIn: estadoNot }
  if (q) {
    and.push({
      OR: [
        { orden: { contains: q, mode: 'insensitive' } },
        { codigoTienda: { contains: q, mode: 'insensitive' } },
        { nombreTienda: { contains: q, mode: 'insensitive' } },
      ],
    })
  }
  if (alerta) {
    and.push({
      OR: [
        { estado: 'CON_NOVEDAD' },
        { estado: 'BORRADOR', createdAt: { lt: new Date(Date.now() - 24 * 3_600_000) } },
      ],
    })
  }
  if (and.length) where.AND = and

  const [rows, total] = await prisma.$transaction([
    prisma.gourmetPedido.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        creadoPor: { select: { name: true } },
        estibas: { select: { ubicacion: true, secuencia: true } },
      },
    }),
    prisma.gourmetPedido.count({ where }),
  ])

  return { success: true, data: rows.map(mapPedidoGourmet), total, page, pageSize }
})
