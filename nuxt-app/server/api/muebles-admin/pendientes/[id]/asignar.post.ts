import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../../utils/prisma'
import { requireRole } from '../../../../utils/auth'
import { ROLES_GESTION_MUEBLES } from '../../../../utils/mueblesCalc'
import { auditar } from '../../../../utils/muebles'
import { mapPendienteMuebles } from '../../../../utils/mapRow'

const schema = z.object({ operarioId: z.string().min(1) })

/**
 * POST /api/muebles-admin/pendientes/:id/asignar
 *
 * El pendiente nace sin dueno (lo reporta el inspector) y un supervisor decide
 * quien va a por el: quien esta libre lo sabe el supervisor, no el inspector.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, ROLES_GESTION_MUEBLES)
  const id = getRouterParam(event, 'id')!

  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Elige el operario' })
  }

  const pendiente = await prisma.pendienteMuebles.findUnique({ where: { id } })
  if (!pendiente) throw createError({ statusCode: 404, statusMessage: 'Pendiente no encontrado' })
  if (pendiente.estado === 'RESUELTO') {
    throw createError({ statusCode: 409, statusMessage: 'Ese pendiente ya esta resuelto' })
  }

  const operario = await prisma.user.findUnique({
    where: { id: parsed.data.operarioId },
    select: { id: true, name: true },
  })
  if (!operario) throw createError({ statusCode: 404, statusMessage: 'Operario no encontrado' })

  const actualizado = await prisma.pendienteMuebles.update({
    where: { id },
    data: {
      estado: 'ASIGNADO',
      asignadoAId: operario.id,
      asignadoPorId: actor.id,
      // El reloj de ejecucion arranca al asignarlo: es cuando deja de esperar en
      // la cola y pasa a ser trabajo de alguien.
      horaInicio: pendiente.horaInicio ?? new Date(),
    },
    include: {
      orden: { select: { id: true, codigo: true } },
      creadoPorInspector: { select: { id: true, nombre: true } },
      asignadoA: { select: { id: true, name: true } },
      resueltoPor: { select: { id: true, name: true } },
    },
  })

  await auditar(actor.id, 'UPDATE', 'picking-muebles', id, `Pendiente PLU ${pendiente.plu} asignado a ${operario.name}`)

  return { success: true, data: mapPendienteMuebles(actualizado) }
})
