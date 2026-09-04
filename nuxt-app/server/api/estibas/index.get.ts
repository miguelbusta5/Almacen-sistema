import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { sanearPaginacion } from '../../utils/paginacion'
import { mapEstiba } from '../../utils/mapRow'
import { assertUsuarioEstibas, buildEstibaWhere, ESTIBA_INCLUDE } from '../../utils/estibas'

// GET /api/estibas — listado paginado. Un MONTACARGAS solo ve las suyas.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioEstibas(actor.role)

  const sp = getQuery(event)
  const str = (v: unknown) => (v === undefined || v === null ? undefined : String(v).trim() || undefined)
  const { page, pageSize } = sanearPaginacion(sp.page, sp.pageSize, 25, 100)

  const where = buildEstibaWhere(actor, {
    q: str(sp.q),
    fecha: str(sp.fecha),
    usuarioId: str(sp.usuarioId),
    estado: str(sp.estado),
    pedido: str(sp.pedido),
  })

  const [items, total] = await Promise.all([
    prisma.estiba.findMany({
      where: where as never,
      include: ESTIBA_INCLUDE,
      orderBy: [{ horaInicio: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.estiba.count({ where: where as never }),
  ])

  return { success: true, data: items.map(mapEstiba), total, page, pageSize }
})
