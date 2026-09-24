import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { equipoDelDia, ordenAbierta, ORDEN_INCLUDE, requirePicking, volumenDeOrden } from '../../utils/muebles'
import { mapEquipoMuebles, mapOrdenMuebles } from '../../utils/mapRow'

/**
 * GET /api/picking-muebles/abierta - la orden en curso del operario, su equipo
 * del dia y la capacidad ocupada. Es lo que pinta la pantalla entera.
 */
export default defineEventHandler(async (event) => {
  const actor = await requirePicking(event)
  const [orden, equipo, transferidas] = await Promise.all([
    ordenAbierta(actor.id),
    equipoDelDia(actor.id),
    // Ordenes que le pasaron mientras tenia otra abierta: pendientes de picking.
    prisma.ordenMuebles.findMany({
      where: { transferidaAId: actor.id, estado: 'EN_PICKING', deletedAt: null },
      include: ORDEN_INCLUDE,
      orderBy: { transferidaAt: 'asc' },
    }),
  ])

  return {
    success: true,
    data: {
      orden: orden ? mapOrdenMuebles(orden) : null,
      equipo: equipo ? mapEquipoMuebles(equipo) : null,
      volumen: volumenDeOrden(orden),
      transferidas: transferidas.map(mapOrdenMuebles),
    },
  }
})
