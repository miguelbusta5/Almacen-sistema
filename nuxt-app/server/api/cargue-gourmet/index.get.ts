import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { mapPedidoGourmet } from '../../utils/mapRow'

const ROLES_VEN = ['ADMIN', 'GERENTE', 'OPERACIONES_GOURMET', 'TRANSPORTE', 'SUPERVISOR_TRANSPORTE']

// GET /api/cargue-gourmet?page=1&pageSize=200&ciudad=&estado=&tipoOrden=&q=
// El frontend Nuxt no pagina (pide todo con pageSize=500, igual que
// tienda/transporte) — el cap es más alto que en la API Next.js original
// (que sí pagina con botones Anterior/Siguiente y por eso limita a 50).
export default defineEventHandler(async (event) => {
  await requireRole(event, ROLES_VEN)
  const sp = getQuery(event)
  const page = Math.max(1, parseInt(String(sp.page ?? '1')) || 1)
  const pageSize = Math.min(500, Math.max(1, parseInt(String(sp.pageSize ?? '200')) || 200))
  const ciudad = String(sp.ciudad ?? '').trim()
  const estado = String(sp.estado ?? '').trim()
  const tipoOrden = String(sp.tipoOrden ?? '').trim()
  const q = String(sp.q ?? '').trim()

  const where: any = {}
  if (ciudad) where.ciudadDestino = ciudad
  if (estado) where.estado = estado
  if (tipoOrden) where.tipoOrden = tipoOrden
  if (q) {
    where.OR = [
      { orden: { contains: q, mode: 'insensitive' } },
      { codigoTienda: { contains: q, mode: 'insensitive' } },
      { nombreTienda: { contains: q, mode: 'insensitive' } },
    ]
  }

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
