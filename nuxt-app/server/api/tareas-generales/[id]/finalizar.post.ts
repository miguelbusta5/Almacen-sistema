import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { assertPuedeMandarTarea, auditarTarea, mapTareaGeneral, TAREA_GENERAL_INCLUDE } from '../../../utils/tareasGenerales'
import { tareaTerminada } from '../../../utils/tareasGeneralesCalc'

const schema = z.object({
  // Sin usuarioId se cierra la tarea entera; con el, solo esa persona.
  usuarioId: z.string().min(1).nullable().optional(),
})

/**
 * POST /api/tareas-generales/:id/finalizar - PARA EL RELOJ.
 *
 * Quien la mando decide cuando termina: puede sacar al que ya acabo y dejar a
 * los demas trabajando, o cerrarla para todos de una vez.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertPuedeMandarTarea(actor.role)
  const id = getRouterParam(event, 'id')!

  const parsed = schema.safeParse(await readBody(event).catch(() => ({})))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Petición inválida' })
  const usuarioId = parsed.data.usuarioId ?? null

  const tarea = await prisma.tareaGeneral.findUnique({ where: { id }, include: TAREA_GENERAL_INCLUDE })
  if (!tarea) throw createError({ statusCode: 404, statusMessage: 'Tarea no encontrada' })
  if (tarea.estado !== 'EN_CURSO') {
    throw createError({ statusCode: 409, statusMessage: 'Esa tarea ya está terminada' })
  }
  if (usuarioId && !tarea.asignados.some((a) => a.usuarioId === usuarioId && a.horaFin == null)) {
    throw createError({ statusCode: 409, statusMessage: 'Esa persona ya no tiene la tarea abierta' })
  }

  const now = new Date()
  const actualizada = await prisma.$transaction(async (tx) => {
    await tx.asignadoTareaGeneral.updateMany({
      where: { tareaId: id, horaFin: null, ...(usuarioId ? { usuarioId } : {}) },
      data: { horaFin: now, finalizadoPorId: actor.id },
    })
    const asignados = await tx.asignadoTareaGeneral.findMany({
      where: { tareaId: id }, select: { horaFin: true },
    })
    // La tarea termina cuando ya nadie la tiene abierta.
    if (tareaTerminada(asignados)) {
      await tx.tareaGeneral.update({
        where: { id },
        data: { estado: 'FINALIZADA', horaFin: now, finalizadaPorId: actor.id },
      })
    }
    return tx.tareaGeneral.findUniqueOrThrow({ where: { id }, include: TAREA_GENERAL_INCLUDE })
  })

  const quien = usuarioId
    ? tarea.asignados.find((a) => a.usuarioId === usuarioId)?.usuario?.name ?? 'un operario'
    : 'todos'
  await auditarTarea(actor.id, 'UPDATE', id, `Tarea general finalizada para ${quien}`)

  return { success: true, data: mapTareaGeneral(actualizada) }
})
