import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { mapPendiente } from '../../utils/mapRow'
import { assertVePendientes, PENDIENTE_INCLUDE, puedeVerAlmacenamiento } from '../../utils/resurtido'
import { esSolicitante } from '../../utils/resurtidoCalc'
import { conCargaPendientes } from '../../utils/carga'

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

  const base = { deletedAt: null, ...(soloMios && { solicitadoPorId: actor.id }) }
  // Lo abierto va entero: es lo que alguien tiene que resolver. De lo ya
  // ubicado basta con lo reciente. Con un solo limite para todo, cuando se
  // acumulaban ubicados las devoluciones y novedades se quedaban fuera.
  const [abiertos, ubicados] = await Promise.all([
    prisma.pendienteGourmet.findMany({
      where: { ...base, estado: { not: 'COMPLETADO' } },
      include: PENDIENTE_INCLUDE,
      orderBy: [{ estado: 'asc' }, { solicitadoAt: 'desc' }],
    }),
    prisma.pendienteGourmet.findMany({
      where: { ...base, estado: 'COMPLETADO' },
      include: PENDIENTE_INCLUDE,
      orderBy: { completadoAt: 'desc' },
      take: 60,
    }),
  ])

  return { success: true, data: await conCargaPendientes([...abiertos, ...ubicados].map(mapPendiente)) }
})
