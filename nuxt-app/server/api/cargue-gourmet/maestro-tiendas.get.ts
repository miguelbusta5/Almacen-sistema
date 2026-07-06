import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'

const ROLES_VEN = ['ADMIN', 'GERENTE', 'OPERACIONES_GOURMET', 'TRANSPORTE', 'SUPERVISOR_TRANSPORTE']
const MAX_RESULTS = 50

// GET /api/cargue-gourmet/maestro-tiendas?q=&codigo=&includeInactive=1
export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, ROLES_VEN)
  const sp = getQuery(event)
  const codigo = String(sp.codigo ?? '').trim()
  const q = String(sp.q ?? '').trim()
  const includeInactive = sp.includeInactive === '1' && ['ADMIN', 'GERENTE'].includes(actor.role)

  const where: any = includeInactive ? {} : { activo: true }
  if (codigo) {
    where.codigo = codigo
  } else if (q) {
    where.OR = [
      { codigo: { contains: q, mode: 'insensitive' } },
      { tienda: { contains: q, mode: 'insensitive' } },
      { ciudad: { contains: q, mode: 'insensitive' } },
    ]
  }

  const rows = await prisma.maestroTiendaGourmet.findMany({ where, orderBy: { tienda: 'asc' }, take: MAX_RESULTS })
  return { success: true, data: rows.map((r) => ({ codigo: r.codigo, tienda: r.tienda, ciudad: r.ciudad, activo: r.activo })) }
})
