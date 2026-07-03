import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { mapGuardado } from '../../utils/mapRow'

// GET /api/transporte?page=1&pageSize=200&q=&estado=&tipo=
export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const sp = getQuery(event)
  const page = Math.max(1, parseInt(String(sp.page ?? '1')) || 1)
  const pageSize = Math.min(500, Math.max(50, parseInt(String(sp.pageSize ?? '200')) || 200))
  const q = String(sp.q ?? '').trim()
  const estado = String(sp.estado ?? '')
  const tipo = String(sp.tipo ?? '')

  const where: any = {}
  if (estado) where.estado = estado
  if (tipo) where.tipo = tipo
  if (q) where.OR = [
    { documento: { contains: q, mode: 'insensitive' } },
    { ubicacion: { contains: q, mode: 'insensitive' } },
  ]

  const [rows, total] = await prisma.$transaction([
    prisma.transporteGuardado.findMany({ where, orderBy: [{ fecha: 'desc' }, { created_at: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.transporteGuardado.count({ where }),
  ])

  return { success: true, data: rows.map(mapGuardado), total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) }
})
