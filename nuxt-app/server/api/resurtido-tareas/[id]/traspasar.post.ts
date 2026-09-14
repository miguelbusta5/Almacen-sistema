import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapTareaResurtido } from '../../../utils/mapRow'
import {
  abrirTramoTarea, assertEjecutor, avisar, cerrarTramoTarea, responsableDeTarea, TAREA_INCLUDE,
} from '../../../utils/resurtido'
import { ROLES_RECEPTORES } from '../../../utils/montacargasCalc'

const schema = z.object({ operarioId: z.string().min(1) })

/**
 * POST /api/resurtido-tareas/:id/traspasar - pasa la tarea a un ayudante.
 *
 * Como en todos los procesos del CEDI: quien la empezo (escaneo la ubicacion) se
 * la pasa a un ayudante y el reloj NO se reinicia. Se cierra su tramo y se abre
 * el del ayudante en el mismo instante; el ayudante escanea el PLU, baja y la
 * cierra. Vale igual para la tarea roja que lleva un pendiente sumado: el
 * pendiente va con ella y se da por ubicado cuando el ayudante la cierre.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertEjecutor(actor.role)

  const id = getRouterParam(event, 'id')!
  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Elige a quien se la pasas' })
  }
  if (parsed.data.operarioId === actor.id) {
    throw createError({ statusCode: 400, statusMessage: 'No te la puedes pasar a ti mismo' })
  }

  const tarea = await prisma.tareaResurtido.findUnique({
    where: { id },
    select: {
      estado: true, plu: true, descripcion: true, horaInicio: true, responsableId: true,
      unidadesSolicitadas: true, unidadesPendientes: true,
      montaje: { select: { operarioId: true, deletedAt: true } },
      tramos: { select: { id: true } },
    },
  })
  if (!tarea || tarea.montaje.deletedAt) {
    throw createError({ statusCode: 404, statusMessage: 'Tarea no encontrada' })
  }
  if (responsableDeTarea(tarea) !== actor.id) {
    throw createError({ statusCode: 403, statusMessage: 'Solo puedes pasar las tareas que tienes tu' })
  }
  if (tarea.estado === 'COMPLETADA') {
    throw createError({ statusCode: 409, statusMessage: 'Esa tarea ya esta completada' })
  }
  // Se pasa lo que ya se tiene en la mano: sin la ubicacion escaneada el reloj
  // no ha arrancado y no hay tramo que cerrar.
  if (!tarea.horaInicio) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Escanea primero la ubicacion: se pasa con el reloj corriendo',
    })
  }

  const ayudante = await prisma.user.findFirst({
    where: { id: parsed.data.operarioId, active: true, role: { in: [...ROLES_RECEPTORES] } },
    select: { id: true, name: true },
  })
  if (!ayudante) throw createError({ statusCode: 400, statusMessage: 'Ese operario no existe o esta inactivo' })

  const now = new Date()
  const unidades = tarea.unidadesSolicitadas + tarea.unidadesPendientes
  const actualizada = await prisma.$transaction(async (tx) => {
    // Una empezada antes de que existieran los tramos: su tiempo se guarda como
    // tramo de quien la tenia, para no perderlo al pasarla.
    if (tarea.tramos.length === 0) await abrirTramoTarea(tx, id, actor.id, tarea.horaInicio!)
    await cerrarTramoTarea(tx, id, now)
    await abrirTramoTarea(tx, id, ayudante.id, now)
    const t = await tx.tareaResurtido.update({
      where: { id },
      data: { responsableId: ayudante.id, pasadoPorId: actor.id },
      include: TAREA_INCLUDE,
    })
    await avisar(tx, [ayudante.id], {
      tipo: 'TAREA_RESURTIDO_PASADA',
      titulo: `${actor.name ?? 'Un companero'} te paso una tarea de resurtido`,
      descripcion: `${unidades} de ${tarea.descripcion}: ya esta en marcha, tu la cierras`,
      enlace: '/dashboard/resurtido',
    })
    return t
  })

  await prisma.activityLog.create({
    data: {
      userId: actor.id, action: 'UPDATE', module: 'resurtido',
      recordId: id, details: `Tarea de resurtido PLU ${tarea.plu} pasada a ${ayudante.name}`,
    },
  }).catch(() => {})

  return { success: true, data: mapTareaResurtido(actualizada) }
})
