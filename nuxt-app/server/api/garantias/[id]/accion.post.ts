import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireRole } from '../../../utils/auth'
import { auditarGarantia, INCLUDE_GARANTIA, mapGarantia } from '../../../utils/garantias'

const schema = z.object({ accion: z.enum(['PAUSAR', 'REANUDAR', 'FINALIZAR']) })
export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, ['GARANTIAS'])
  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Acción inválida' })
  const id = getRouterParam(event, 'id')!
  const accion = parsed.data.accion
  const ahora = new Date()
  const tarea = await prisma.$transaction(async (tx) => {
    const actual = await tx.tareaGarantia.findFirst({ where: { id, usuarioId: actor.id }, include: { tramos: { orderBy: { inicio: 'desc' }, take: 1 } } })
    if (!actual) throw createError({ statusCode: 404, statusMessage: 'Tarea no encontrada' })
    const esperado = accion === 'REANUDAR' ? 'PAUSADA' : 'EN_CURSO'
    if (actual.estado !== esperado && !(accion === 'FINALIZAR' && actual.estado === 'PAUSADA')) throw createError({ statusCode: 409, statusMessage: 'La tarea cambió de estado; actualiza la lista' })
    const cambio = await tx.tareaGarantia.updateMany({ where: { id, usuarioId: actor.id, estado: actual.estado }, data: {
      estado: accion === 'FINALIZAR' ? 'FINALIZADA' : accion === 'PAUSAR' ? 'PAUSADA' : 'EN_CURSO',
      ...(accion === 'FINALIZAR' ? { horaFin: ahora } : {}),
    } })
    if (cambio.count !== 1) throw createError({ statusCode: 409, statusMessage: 'La tarea cambió de estado; actualiza la lista' })
    if (accion === 'REANUDAR') await tx.tramoGarantia.create({ data: { tareaId: id, inicio: ahora } })
    else if (actual.estado === 'EN_CURSO') {
      const abierto = actual.tramos[0]
      if (!abierto || abierto.fin) throw createError({ statusCode: 409, statusMessage: 'No hay tramo activo' })
      await tx.tramoGarantia.update({ where: { id: abierto.id }, data: { fin: ahora } })
    }
    return tx.tareaGarantia.findUniqueOrThrow({ where: { id }, include: INCLUDE_GARANTIA })
  })
  await auditarGarantia(actor.id, accion, id, `${accion} · PLU ${tarea.plu}`)
  return { data: mapGarantia(tarea, false) }
})
