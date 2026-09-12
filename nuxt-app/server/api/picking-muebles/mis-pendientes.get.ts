import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { requirePicking } from '../../utils/muebles'
import { esGestionMuebles } from '../../utils/mueblesCalc'
import { mapPendienteMuebles } from '../../utils/mapRow'

/** GET /api/picking-muebles/mis-pendientes - bandeja del operario. */
export default defineEventHandler(async (event) => {
  const actor = await requirePicking(event)

  const pendientes = await prisma.pendienteMuebles.findMany({
    where: {
      estado: { in: ['PENDIENTE', 'ASIGNADO'] },
      // El operario ve solo lo suyo; gestion ve la cola entera, incluido lo que
      // todavia no tiene dueno.
      ...(esGestionMuebles(actor.role) ? {} : { asignadoAId: actor.id }),
    },
    include: {
      orden: { select: { id: true, codigo: true } },
      creadoPorInspector: { select: { id: true, nombre: true } },
      asignadoA: { select: { id: true, name: true } },
      resueltoPor: { select: { id: true, name: true } },
    },
    orderBy: { solicitadoAt: 'asc' },
  })

  return { success: true, data: pendientes.map(mapPendienteMuebles) }
})
