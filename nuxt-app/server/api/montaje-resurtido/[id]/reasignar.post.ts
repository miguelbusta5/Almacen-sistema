import { defineOperacionAlmacenHandler } from '../../../utils/operacionAlmacen'
import { getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapMontaje } from '../../../utils/mapRow'
import {
  abrirTramoTarea, assertPuedeMontar, assertVeMontaje, avisar, cerrarTramoTarea, MONTAJE_INCLUDE,
  responsableDeTarea,
} from '../../../utils/resurtido'

const schema = z.object({ operarioId: z.string().min(1) })

/**
 * POST /api/montaje-resurtido/:id/reasignar - pasa lo que falta a otro operario.
 *
 * Para cuando el turno se acaba y el resurtido no se termino. Las tareas
 * COMPLETADAS no se tocan: son trabajo del primero y siguen contando en sus
 * indicadores. Las que faltan pasan al nuevo:
 * - sin empezar: solo cambian de manos; el reloj arranca cuando el nuevo escanee.
 * - en curso: el reloj NO se reinicia. Se cierra el tramo de quien la tenia y se
 *   abre el del nuevo en el mismo instante, como al pasarla a un ayudante.
 * Una tarea roja con pendiente sumado va con ella, como siempre.
 */
export default defineOperacionAlmacenHandler(async (event) => {
  const actor = await requireAuth(event)
  assertVeMontaje(actor.role)
  await assertPuedeMontar(actor.id)

  const id = getRouterParam(event, 'id')!
  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Elige a quien se lo reasignas' })
  const nuevoId = parsed.data.operarioId

  const montaje = await prisma.montajeResurtido.findUnique({
    where: { id },
    select: {
      id: true, estado: true, deletedAt: true, operarioId: true, nombreArchivo: true,
      operario: { select: { name: true } },
      tareas: {
        where: { estado: { not: 'COMPLETADA' } },
        select: {
          id: true, estado: true, horaInicio: true, responsableId: true,
          tramos: { select: { id: true } },
        },
      },
    },
  })
  if (!montaje || montaje.deletedAt) throw createError({ statusCode: 404, statusMessage: 'Montaje no encontrado' })
  if (montaje.estado === 'COMPLETADO') {
    throw createError({ statusCode: 409, statusMessage: 'Ese resurtido ya esta terminado' })
  }
  if (montaje.tareas.length === 0) {
    throw createError({ statusCode: 409, statusMessage: 'No le quedan tareas por hacer' })
  }

  const nuevo = await prisma.user.findFirst({
    where: { id: nuevoId, active: true, role: { in: ['OPERARIO_ALMACENAMIENTO', 'MONTACARGAS'] } },
    select: { id: true, name: true },
  })
  if (!nuevo) throw createError({ statusCode: 400, statusMessage: 'Ese operario no existe o esta inactivo' })

  const faltan = montaje.tareas.map((t) => ({ ...t, montaje: { operarioId: montaje.operarioId } }))
  if (faltan.every((t) => responsableDeTarea(t) === nuevo.id)) {
    throw createError({ statusCode: 400, statusMessage: 'Lo que falta ya lo tiene esa persona' })
  }

  // Quienes las tenian, para avisarles que ya no.
  const anteriores = new Set(faltan.map((t) => responsableDeTarea(t)).filter((u) => u !== nuevo.id))
  // Suyas sin mas si el nuevo es el dueño del montaje (null), como al devolver.
  const responsableId = nuevo.id === montaje.operarioId ? null : nuevo.id

  const now = new Date()
  let pendientes = 0
  let enCurso = 0
  const actualizado = await prisma.$transaction(async (tx) => {
    for (const t of faltan) {
      if (responsableDeTarea(t) === nuevo.id) continue
      if (t.horaInicio) {
        // Empezada antes de que existieran los tramos: su tiempo se guarda como
        // tramo de quien la tenia, para no perderlo al reasignarla.
        if (t.tramos.length === 0) {
          await tx.tramoTareaResurtido.create({
            data: { tareaId: t.id, usuarioId: responsableDeTarea(t), orden: 1, inicio: t.horaInicio },
          })
        }
        await cerrarTramoTarea(tx, t.id, now)
        await abrirTramoTarea(tx, t.id, nuevo.id, now)
        enCurso += 1
      } else {
        pendientes += 1
      }
      await tx.tareaResurtido.update({
        where: { id: t.id },
        data: { responsableId, pasadoPorId: null },
      })
    }

    const total = pendientes + enCurso
    await avisar(tx, [nuevo.id], {
      tipo: 'RESURTIDO_REASIGNADO',
      titulo: 'Te reasignaron un resurtido',
      descripcion: `${total} tarea${total === 1 ? '' : 's'} de ${montaje.operario.name ?? 'otro operario'} (${montaje.nombreArchivo})`,
      enlace: '/dashboard/resurtido',
    })
    await avisar(tx, [...anteriores], {
      tipo: 'RESURTIDO_REASIGNADO',
      titulo: 'Tu resurtido pasó a otro operario',
      descripcion: `Lo que faltaba de ${montaje.nombreArchivo} lo termina ${nuevo.name}`,
      enlace: '/dashboard/resurtido',
    })

    return tx.montajeResurtido.findUniqueOrThrow({ where: { id }, include: MONTAJE_INCLUDE })
  })

  await prisma.activityLog.create({
    data: {
      userId: actor.id, action: 'UPDATE', module: 'montaje-resurtido', recordId: id,
      details: `Resurtido ${montaje.nombreArchivo} reasignado a ${nuevo.name}: ${pendientes} sin empezar y ${enCurso} en curso`,
    },
  }).catch(() => {})

  return { success: true, data: mapMontaje(actualizado), reasignadas: { pendientes, enCurso } }
})
