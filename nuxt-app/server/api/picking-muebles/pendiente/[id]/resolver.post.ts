import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../../utils/prisma'
import { auditar, requirePickingActivo } from '../../../../utils/muebles'
import { mapPendienteMuebles } from '../../../../utils/mapRow'

const INCLUDE = {
  orden: { select: { id: true, codigo: true } },
  creadoPorInspector: { select: { id: true, nombre: true } },
  asignadoA: { select: { id: true, name: true } },
  resueltoPor: { select: { id: true, name: true } },
} as const

/**
 * POST /api/picking-muebles/pendiente/:id/resolver - el operario lo recolecto.
 *
 * `horaInicio` se rellena aqui si el pendiente nunca se "empezo": mejor un
 * tiempo de ejecucion de cero que un hueco, y la espera (solicitadoAt -> ahora)
 * se sigue midiendo igual, que es el numero que le importa a operacion.
 */
export default defineEventHandler(async (event) => {
  const actor = await requirePickingActivo(event)
  const id = getRouterParam(event, 'id')!

  const pendiente = await prisma.pendienteMuebles.findUnique({ where: { id } })
  if (!pendiente) throw createError({ statusCode: 404, statusMessage: 'Pendiente no encontrado' })
  if (pendiente.estado === 'RESUELTO') {
    throw createError({ statusCode: 409, statusMessage: 'Ese pendiente ya esta resuelto' })
  }
  if (pendiente.asignadoAId && pendiente.asignadoAId !== actor.id) {
    throw createError({ statusCode: 403, statusMessage: 'Ese pendiente esta asignado a otro operario' })
  }

  const now = new Date()
  const actualizado = await prisma.pendienteMuebles.update({
    where: { id },
    data: {
      estado: 'RESUELTO',
      resueltoPorId: actor.id,
      horaInicio: pendiente.horaInicio ?? now,
      horaFin: now,
    },
    include: INCLUDE,
  })

  await auditar(actor.id, 'UPDATE', 'picking-muebles', id, `Pendiente PLU ${pendiente.plu} resuelto`)

  return { success: true, data: mapPendienteMuebles(actualizado) }
})
