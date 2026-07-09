import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { mapGuardado } from '../../utils/mapRow'
import { tieneAlertaEntrega } from '../../utils/almacenaje'

// GET /api/transporte?page=1&pageSize=30&q=&estado=&tipo=&alerta=
export default defineEventHandler(async (event) => {
  await requireAuth(event)
  const sp = getQuery(event)
  const page = Math.max(1, parseInt(String(sp.page ?? '1')) || 1)
  const pageSize = Math.min(200, Math.max(20, parseInt(String(sp.pageSize ?? '30')) || 30))
  const q = String(sp.q ?? '').trim()
  const estado = String(sp.estado ?? '')
  const tipo = String(sp.tipo ?? '')
  const alerta = sp.alerta === '1' || sp.alerta === 'true'

  const where: any = {}
  if (estado) where.estado = estado
  if (tipo) where.tipo = tipo
  if (q) where.OR = [
    { documento: { contains: q, mode: 'insensitive' } },
    { ubicacion: { contains: q, mode: 'insensitive' } },
  ]
  if (alerta) {
    // "Alerta" depende de una fecha de entrega comprometida embebida en la
    // nota (texto libre) — no se puede expresar como filtro SQL directo.
    // Se calcula sobre los activos (acotado por estado, ya indexado) y se
    // filtra por clientId, igual que hace /conteos.
    const activos = await prisma.transporteGuardado.findMany({
      where: { estado: 'PENDIENTE DESPACHO' },
      select: { client_id: true, nota: true },
    })
    where.client_id = { in: activos.filter((g) => tieneAlertaEntrega(g.nota)).map((g) => g.client_id) }
  }

  const [rows, total] = await prisma.$transaction([
    prisma.transporteGuardado.findMany({ where, orderBy: [{ fecha: 'desc' }, { created_at: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.transporteGuardado.count({ where }),
  ])

  return { success: true, data: rows.map(mapGuardado), total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) }
})
