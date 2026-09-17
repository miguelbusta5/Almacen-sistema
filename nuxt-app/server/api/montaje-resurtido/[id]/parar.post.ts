import { defineOperacionAlmacenHandler } from '../../../utils/operacionAlmacen'
import { getRouterParam, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapMontaje } from '../../../utils/mapRow'
import { assertPuedeMontar, assertVeMontaje, avisar, MONTAJE_INCLUDE } from '../../../utils/resurtido'

/**
 * POST /api/montaje-resurtido/:id/parar - supervision detiene un resurtido.
 *
 * Las tareas SIN EMPEZAR quedan detenidas: el operario deja de verlas y no las
 * puede iniciar. Las que ya estan en curso las termina el operario (su reloj no
 * se toca). Se retoma con "Reasignar lo que falta", que quita la detencion.
 */
export default defineOperacionAlmacenHandler(async (event) => {
  const actor = await requireAuth(event)
  assertVeMontaje(actor.role)
  await assertPuedeMontar(actor.id)

  const id = getRouterParam(event, 'id')!
  const montaje = await prisma.montajeResurtido.findUnique({
    where: { id },
    select: {
      id: true, estado: true, deletedAt: true, detenidoAt: true, operarioId: true, nombreArchivo: true,
      tareas: { where: { estado: 'PENDIENTE' }, select: { id: true, responsableId: true } },
    },
  })
  if (!montaje || montaje.deletedAt) throw createError({ statusCode: 404, statusMessage: 'Montaje no encontrado' })
  if (montaje.estado === 'COMPLETADO') throw createError({ statusCode: 409, statusMessage: 'Ese resurtido ya está terminado' })
  if (montaje.detenidoAt) throw createError({ statusCode: 409, statusMessage: 'Ese resurtido ya está parado' })
  if (montaje.tareas.length === 0) {
    throw createError({ statusCode: 409, statusMessage: 'No le quedan tareas sin empezar: lo que está en curso lo termina el operario' })
  }

  const now = new Date()
  const actualizado = await prisma.$transaction(async (tx) => {
    await tx.montajeResurtido.update({ where: { id }, data: { detenidoAt: now, detenidoPorId: actor.id } })
    // A quien tenia las tareas sin empezar: que no las busque.
    const afectados = new Set(montaje.tareas.map((t) => t.responsableId ?? montaje.operarioId))
    await avisar(tx, [...afectados], {
      tipo: 'RESURTIDO_PARADO',
      titulo: 'Supervisión paró un resurtido',
      descripcion: `Las tareas sin empezar de ${montaje.nombreArchivo} quedaron detenidas; termina las que ya tienes en curso`,
      enlace: '/dashboard/resurtido',
    })
    return tx.montajeResurtido.findUniqueOrThrow({ where: { id }, include: MONTAJE_INCLUDE })
  })

  await prisma.activityLog.create({
    data: {
      userId: actor.id, action: 'UPDATE', module: 'montaje-resurtido', recordId: id,
      details: `Resurtido ${montaje.nombreArchivo} parado: ${montaje.tareas.length} tareas sin empezar detenidas`,
    },
  }).catch(() => {})

  return { success: true, data: mapMontaje(actualizado), detenidas: montaje.tareas.length }
})
