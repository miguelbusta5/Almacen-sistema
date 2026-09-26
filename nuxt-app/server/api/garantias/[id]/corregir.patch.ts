import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireRole } from '../../../utils/auth'
import { GESTORES_GARANTIAS, INCLUDE_GARANTIA, mapGarantia } from '../../../utils/garantias'

const schema = z.object({ horaInicio: z.string().datetime({ offset: true }), horaFin: z.string().datetime({ offset: true }), motivo: z.string().trim().min(5).max(500) })

export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, GESTORES_GARANTIAS)
  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Indica horas válidas y un motivo de al menos 5 caracteres' })
  const { motivo } = parsed.data
  const inicio = new Date(parsed.data.horaInicio)
  const fin = new Date(parsed.data.horaFin)
  if (inicio >= fin || fin > new Date()) throw createError({ statusCode: 400, statusMessage: 'El fin debe ser posterior al inicio y no puede estar en el futuro' })
  const id = getRouterParam(event, 'id')!
  const tarea = await prisma.$transaction(async (tx) => {
    const actual = await tx.tareaGarantia.findUnique({ where: { id }, include: INCLUDE_GARANTIA })
    if (!actual) throw createError({ statusCode: 404, statusMessage: 'Tarea no encontrada' })
    if (actual.estado !== 'FINALIZADA' || actual.tramos.length === 0) throw createError({ statusCode: 409, statusMessage: 'Solo se corrigen tareas finalizadas' })
    const primero = actual.tramos[0]!
    const ultimo = actual.tramos.at(-1)!
    const finFueActivo = ultimo.fin?.getTime() === actual.horaFin?.getTime()
    if ((primero.id !== ultimo.id || !finFueActivo) && inicio >= primero.fin!
      || (!finFueActivo && fin < ultimo.fin!)
      || (primero.id !== ultimo.id && finFueActivo && fin <= ultimo.inicio)) {
      throw createError({ statusCode: 400, statusMessage: 'Las horas no pueden atravesar una pausa' })
    }
    if (primero.id === ultimo.id) {
      await tx.tramoGarantia.update({ where: { id: primero.id }, data: { inicio, ...(finFueActivo ? { fin } : {}) } })
    } else {
      await tx.tramoGarantia.update({ where: { id: primero.id }, data: { inicio } })
      if (finFueActivo) await tx.tramoGarantia.update({ where: { id: ultimo.id }, data: { fin } })
    }
    await tx.tareaGarantia.update({ where: { id }, data: { horaInicio: inicio, horaFin: fin, corregidoPorId: actor.id } })
    await tx.activityLog.create({ data: {
      userId: actor.id, action: 'CORRECTION', module: 'garantias', recordId: id,
      details: JSON.stringify({ motivo, antes: { inicio: actual.horaInicio, fin: actual.horaFin }, despues: { inicio, fin } }),
    } })
    return tx.tareaGarantia.findUniqueOrThrow({ where: { id }, include: INCLUDE_GARANTIA })
  })
  return { data: mapGarantia(tarea, true) }
})
