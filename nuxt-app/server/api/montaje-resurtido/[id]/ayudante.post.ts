import { createError, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { defineOperacionAlmacenHandler } from '../../../utils/operacionAlmacen'
import { requireAuth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { assertPuedeMontar, assertVeMontaje, avisar, MONTAJE_INCLUDE } from '../../../utils/resurtido'
import { ROLES_RECEPTORES } from '../../../utils/montacargasCalc'
import { mapMontaje } from '../../../utils/mapRow'
const schema = z.object({ ayudanteId: z.string().min(1), tareas: z.array(z.string().min(1)).min(1).max(1000) })
export default defineOperacionAlmacenHandler(async event => {
  const actor = await requireAuth(event); assertVeMontaje(actor.role); await assertPuedeMontar(actor.id)
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Selecciona el ayudante y las tareas sin empezar' })
  const id = getRouterParam(event, 'id')!, b = parsed.data
  const m = await prisma.montajeResurtido.findUnique({ where: { id }, include: MONTAJE_INCLUDE })
  if (!m || m.deletedAt || m.estado === 'COMPLETADO' || m.detenidoAt) throw createError({ statusCode: 409, statusMessage: 'El resurtido debe estar activo' })
  const ids = [...new Set(b.tareas)], tareas = m.tareas.filter(t => ids.includes(t.id))
  if (tareas.length !== ids.length || tareas.some(t => t.estado !== 'PENDIENTE' || t.horaInicio || t.pausaId)) throw createError({ statusCode: 409, statusMessage: 'Alguna tarea ya empezó o está pausada. Actualiza antes de repartir.' })
  const ayudante = await prisma.user.findFirst({ where: { id: b.ayudanteId, active: true, role: { in: [...ROLES_RECEPTORES] } }, select: { id: true, name: true } })
  if (!ayudante) throw createError({ statusCode: 400, statusMessage: 'Ayudante no disponible' })
  await prisma.tareaResurtido.updateMany({ where: { id: { in: ids }, montajeId: id }, data: { responsableId: ayudante.id === m.operarioId ? null : ayudante.id, pasadoPorId: null } })
  await avisar(prisma, [ayudante.id], { tipo: 'ASIGNACION', titulo: 'Apoyo en resurtido', descripcion: `${ids.length} tareas de ${m.nombreArchivo}`, enlace: '/dashboard/resurtido' })
  await prisma.activityLog.create({ data: { userId: actor.id, action: 'UPDATE', module: 'montaje-resurtido', recordId: id, details: `${ids.length} tareas asignadas a ${ayudante.name}: ${ids.join(', ')}` } })
  return { data: mapMontaje(await prisma.montajeResurtido.findUniqueOrThrow({ where: { id }, include: MONTAJE_INCLUDE })) }
})
