import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapPendiente } from '../../../utils/mapRow'
import {
  assertPuedeMontar, assertVePendientes, avisar, PENDIENTE_INCLUDE,
} from '../../../utils/resurtido'

const schema = z.object({ operarioId: z.string().min(1) })

/**
 * POST /api/pendientes/:id/asignar - almacenamiento reparte el pendiente.
 *
 * A quien asigna NO se le mide el tiempo: repartir no es hacer. El reloj del
 * pendiente arranca cuando el operario escanea el PLU.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertVePendientes(actor.role)
  await assertPuedeMontar(actor.id)

  const id = getRouterParam(event, 'id')!
  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }

  const p = await prisma.pendienteGourmet.findUnique({
    where: { id },
    select: { estado: true, deletedAt: true, descripcion: true, unidadesSolicitadas: true },
  })
  if (!p || p.deletedAt) throw createError({ statusCode: 404, statusMessage: 'Pendiente no encontrado' })
  if (p.estado === 'COMPLETADO') {
    throw createError({ statusCode: 409, statusMessage: 'Ese pendiente ya se ubico' })
  }

  const operario = await prisma.user.findFirst({
    where: {
      id: parsed.data.operarioId, active: true,
      role: { in: ['OPERARIO_ALMACENAMIENTO', 'MONTACARGAS'] },
    },
    select: { id: true, name: true },
  })
  if (!operario) throw createError({ statusCode: 400, statusMessage: 'Ese operario no existe o esta inactivo' })

  const now = new Date()
  const actualizado = await prisma.$transaction(async (tx) => {
    await tx.pendienteGourmet.update({
      where: { id },
      data: {
        estado: 'ASIGNADO',
        operarioId: operario.id,
        asignadoPorId: actor.id,
        asignadoAt: now,
      },
    })
    await avisar(tx, [operario.id], {
      tipo: 'PENDIENTE_ASIGNADO',
      titulo: 'Tienes un pendiente asignado',
      descripcion: `${p.unidadesSolicitadas} de ${p.descripcion}`,
      enlace: '/dashboard/resurtido',
    })
    return tx.pendienteGourmet.findUniqueOrThrow({ where: { id }, include: PENDIENTE_INCLUDE })
  })

  await prisma.activityLog.create({
    data: {
      userId: actor.id, action: 'UPDATE', module: 'pendientes',
      recordId: id, details: `Pendiente asignado a ${operario.name}`,
    },
  }).catch(() => {})

  return { success: true, data: mapPendiente(actualizado) }
})
