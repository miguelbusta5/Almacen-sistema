import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapTareaResurtido } from '../../../utils/mapRow'
import { abrirTramoTarea, assertEjecutor, responsableDeTarea, TAREA_INCLUDE } from '../../../utils/resurtido'
import { validarEscaneoPosicion } from '../../../utils/resurtidoCalc'

const schema = z.object({ ubicacion: z.string().min(1).max(120) })

/**
 * POST /api/resurtido-tareas/:id/iniciar - ARRANCA EL RELOJ de la tarea.
 *
 * Lo arranca el ESCANEO de la posicion, no abrir la tarea: asi el tiempo mide
 * caminar hasta el sitio y bajar la mercancia, y no el rato que la pantalla
 * estuvo abierta. Y de paso comprueba que el operario esta donde debe.
 *
 * Arrancarlo abre el tramo de quien la empieza: si despues la pasa a un
 * ayudante, cada uno queda con su parte del tiempo.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertEjecutor(actor.role)

  const id = getRouterParam(event, 'id')!
  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }

  const tarea = await prisma.tareaResurtido.findUnique({
    where: { id },
    include: { montaje: { select: { operarioId: true, deletedAt: true } } },
  })
  if (!tarea || tarea.montaje.deletedAt) {
    throw createError({ statusCode: 404, statusMessage: 'Tarea no encontrada' })
  }
  if (responsableDeTarea(tarea) !== actor.id) {
    throw createError({ statusCode: 403, statusMessage: 'Esa tarea es de otro operario' })
  }
  if (tarea.estado === 'COMPLETADA') {
    throw createError({ statusCode: 409, statusMessage: 'Esa tarea ya esta completada' })
  }

  const error = validarEscaneoPosicion(parsed.data.ubicacion, tarea.altura)
  if (error) throw createError({ statusCode: 400, statusMessage: error })

  // Si ya estaba en curso no se reinicia el reloj: volver a escanear no puede
  // borrar el tiempo que ya llevaba.
  const now = new Date()
  const actualizada = await prisma.$transaction(async (tx) => {
    if (!tarea.horaInicio) await abrirTramoTarea(tx, id, actor.id, now)
    return tx.tareaResurtido.update({
      where: { id },
      data: {
        estado: 'EN_CURSO',
        ...(tarea.horaInicio ? {} : { horaInicio: now }),
      },
      include: TAREA_INCLUDE,
    })
  })

  return { success: true, data: mapTareaResurtido(actualizada) }
})
