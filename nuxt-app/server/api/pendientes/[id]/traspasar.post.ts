import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapPendiente } from '../../../utils/mapRow'
import { assertEjecutor, avisar, PENDIENTE_INCLUDE } from '../../../utils/resurtido'

const schema = z.object({ operarioId: z.string().min(1) })

/**
 * POST /api/pendientes/:id/traspasar - el operario se lo pasa a un ayudante.
 *
 * El reloj es de quien lo termina: arranca cuando el ayudante escanea el PLU.
 * Si el primero ya lo habia empezado, ese tiempo se descarta en vez de
 * repartirlo, porque un pendiente es una sola bajada y no tiene tramos.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertEjecutor(actor.role)

  const id = getRouterParam(event, 'id')!
  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Elige a quien se lo pasas' })
  }
  if (parsed.data.operarioId === actor.id) {
    throw createError({ statusCode: 400, statusMessage: 'No te lo puedes pasar a ti mismo' })
  }

  const p = await prisma.pendienteGourmet.findUnique({
    where: { id },
    select: {
      estado: true, deletedAt: true, operarioId: true, descripcion: true,
      unidadesSolicitadas: true, tareaResurtidoId: true,
    },
  })
  if (!p || p.deletedAt) throw createError({ statusCode: 404, statusMessage: 'Pendiente no encontrado' })
  if (p.operarioId !== actor.id) {
    throw createError({ statusCode: 403, statusMessage: 'Solo puedes pasar los pendientes que tienes tu' })
  }
  if (p.estado === 'COMPLETADO') {
    throw createError({ statusCode: 409, statusMessage: 'Ese pendiente ya se ubico' })
  }
  // Sumado a una tarea de resurtido va con esa tarea: pasarlo suelto la
  // partiria en dos y nadie sabria cuantas unidades le tocan a cada uno.
  if (p.tareaResurtidoId) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Este pendiente va dentro de una tarea de resurtido: se hace con ella',
    })
  }

  const ayudante = await prisma.user.findFirst({
    where: {
      id: parsed.data.operarioId, active: true,
      role: { in: ['OPERARIO_ALMACENAMIENTO', 'MONTACARGAS'] },
    },
    select: { id: true, name: true },
  })
  if (!ayudante) throw createError({ statusCode: 400, statusMessage: 'Ese operario no existe o esta inactivo' })

  const actualizado = await prisma.$transaction(async (tx) => {
    await tx.pendienteGourmet.update({
      where: { id },
      data: {
        estado: 'ASIGNADO',
        operarioId: ayudante.id,
        pasadoPorId: actor.id,
        horaInicio: null,
        horaFin: null,
      },
    })
    await avisar(tx, [ayudante.id], {
      tipo: 'PENDIENTE_ASIGNADO',
      titulo: `${actor.name ?? 'Un companero'} te paso un pendiente`,
      descripcion: `${p.unidadesSolicitadas} de ${p.descripcion}`,
      enlace: '/dashboard/resurtido',
    })
    return tx.pendienteGourmet.findUniqueOrThrow({ where: { id }, include: PENDIENTE_INCLUDE })
  })

  await prisma.activityLog.create({
    data: {
      userId: actor.id, action: 'UPDATE', module: 'pendientes',
      recordId: id, details: `Pendiente pasado a ${ayudante.name}`,
    },
  }).catch(() => {})

  return { success: true, data: mapPendiente(actualizado) }
})
