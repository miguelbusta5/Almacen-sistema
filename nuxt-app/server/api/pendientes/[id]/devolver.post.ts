import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapPendiente } from '../../../utils/mapRow'
import {
  assertEjecutor, avisar, idsAlmacenamiento, PENDIENTE_INCLUDE,
} from '../../../utils/resurtido'
import { MOTIVO_DEVOLUCION_LABEL, validarDevolucion } from '../../../utils/resurtidoCalc'

const schema = z.object({
  motivo: z.enum(['MUEBLES', 'NO_HAY', 'OTRO']),
  detalle: z.string().max(500).optional(),
})

/**
 * POST /api/pendientes/:id/devolver - el operario lo regresa sin bajarlo.
 *
 * El caso que lo motiva: el PLU resulta ser de MUEBLES y no de gourmet, asi que
 * no es trabajo suyo. Devolverlo no es fallar: el reloj se descarta entero en
 * vez de contarle un tiempo por una tarea que no le correspondia.
 *
 * Vuelve a quien lo pidio, que es quien puede corregirlo o anularlo.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertEjecutor(actor.role)

  const id = getRouterParam(event, 'id')!
  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const detalle = parsed.data.detalle?.trim() ?? ''

  const error = validarDevolucion(parsed.data.motivo, detalle)
  if (error) throw createError({ statusCode: 400, statusMessage: error })

  const p = await prisma.pendienteGourmet.findUnique({
    where: { id },
    select: {
      estado: true, deletedAt: true, operarioId: true, descripcion: true,
      solicitadoPorId: true, asignadoPorId: true,
    },
  })
  if (!p || p.deletedAt) throw createError({ statusCode: 404, statusMessage: 'Pendiente no encontrado' })
  if (p.operarioId !== actor.id) {
    throw createError({ statusCode: 403, statusMessage: 'Ese pendiente es de otro operario' })
  }
  if (p.estado === 'COMPLETADO') {
    throw createError({ statusCode: 409, statusMessage: 'Ese pendiente ya se ubico' })
  }

  const etiqueta = MOTIVO_DEVOLUCION_LABEL[parsed.data.motivo]
  const now = new Date()

  const actualizado = await prisma.$transaction(async (tx) => {
    await tx.pendienteGourmet.update({
      where: { id },
      data: {
        estado: 'DEVUELTO',
        devueltoPorId: actor.id,
        devueltoAt: now,
        motivoDevolucion: detalle ? `${etiqueta}: ${detalle}` : etiqueta,
        // El reloj se descarta: no era su tarea, no se le cuenta el tiempo.
        horaInicio: null,
        horaFin: null,
      },
    })

    await avisar(tx, [p.solicitadoPorId, ...(await idsAlmacenamiento())], {
      tipo: 'PENDIENTE_DEVUELTO',
      titulo: 'Pendiente devuelto',
      descripcion: `${actor.name ?? 'El operario'} devolvio ${p.descripcion}: ${etiqueta}`,
      enlace: '/dashboard/pendientes',
    })

    return tx.pendienteGourmet.findUniqueOrThrow({ where: { id }, include: PENDIENTE_INCLUDE })
  })

  await prisma.activityLog.create({
    data: {
      userId: actor.id, action: 'UPDATE', module: 'pendientes',
      recordId: id, details: `Pendiente devuelto: ${etiqueta}`,
    },
  }).catch(() => {})

  return { success: true, data: mapPendiente(actualizado) }
})
