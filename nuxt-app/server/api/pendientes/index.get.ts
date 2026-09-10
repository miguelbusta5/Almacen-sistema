import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { mapPendiente } from '../../utils/mapRow'
import { assertVePendientes, PENDIENTE_INCLUDE, puedeVerAlmacenamiento } from '../../utils/resurtido'
import { esSolicitante } from '../../utils/resurtidoCalc'

/**
 * GET /api/pendientes
 *
 * Quien solicita ve LO SUYO; almacenamiento lo ve todo, que es lo que necesita
 * para repartir. Un solicitante viendo los pendientes de otro no gana nada y le
 * ensucia la pantalla.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertVePendientes(actor.role)

  const soloMios = esSolicitante(actor.role) && !puedeVerAlmacenamiento(actor.role)

  const rows = await prisma.pendienteGourmet.findMany({
    where: {
      deletedAt: null,
      ...(soloMios && { solicitadoPorId: actor.id }),
    },
    include: PENDIENTE_INCLUDE,
    orderBy: [{ estado: 'asc' }, { solicitadoAt: 'desc' }],
    take: 120,
  })

  return { success: true, data: rows.map(mapPendiente) }
})
