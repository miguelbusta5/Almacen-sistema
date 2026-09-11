import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapPendiente } from '../../../utils/mapRow'
import {
  assertVePendientes, avisar, cerrarTramoPendiente, PENDIENTE_INCLUDE, puedeMontarResurtido,
} from '../../../utils/resurtido'
import { puedeAsignarPendiente } from '../../../utils/resurtidoCalc'

const schema = z.object({ operarioId: z.string().min(1) })

/**
 * POST /api/pendientes/:id/asignar - reparte el pendiente a un operario.
 *
 * Lo puede hacer almacenamiento (permiso por persona) o quien lo pidio. A
 * ninguno se le mide tiempo: repartir no es hacer.
 *
 * Regla de prioridad: un pendiente es alguien esperando en la tienda, asi que
 * va antes que el resurtido de rutina.
 *
 * - Si el operario YA TIENE ese PLU en su resurtido, el pendiente no es una
 *   tarea aparte: se suman sus unidades a esa tarea, que sube al principio y se
 *   pinta en rojo. Se dara por ubicado cuando esa tarea se complete.
 * - Si no, queda como tarea propia y su pantalla la pone la primera de la lista.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertVePendientes(actor.role)

  const id = getRouterParam(event, 'id')!
  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }

  const p = await prisma.pendienteGourmet.findUnique({
    where: { id },
    select: {
      estado: true, deletedAt: true, descripcion: true, unidadesSolicitadas: true,
      plu: true, solicitadoPorId: true, tareaResurtidoId: true,
    },
  })
  if (!p || p.deletedAt) throw createError({ statusCode: 404, statusMessage: 'Pendiente no encontrado' })

  const permitido = puedeAsignarPendiente({
    tienePermisoMontar: await puedeMontarResurtido(actor.id),
    esQuienLoPidio: p.solicitadoPorId === actor.id,
  })
  if (!permitido) {
    throw createError({ statusCode: 403, statusMessage: 'No puedes asignar este pendiente' })
  }
  if (p.estado === 'COMPLETADO') {
    throw createError({ statusCode: 409, statusMessage: 'Ese pendiente ya se ubico' })
  }
  // Ya sumado a un resurtido: cambiarlo de manos partiria la tarea.
  if (p.tareaResurtidoId) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Este pendiente ya va dentro de una tarea de resurtido',
    })
  }

  const operario = await prisma.user.findFirst({
    where: {
      id: parsed.data.operarioId, active: true,
      role: { in: ['OPERARIO_ALMACENAMIENTO', 'MONTACARGAS'] },
    },
    select: { id: true, name: true },
  })
  if (!operario) throw createError({ statusCode: 400, statusMessage: 'Ese operario no existe o esta inactivo' })

  // ¿Ya tiene ese PLU en su resurtido, sin hacer?
  const tarea = await prisma.tareaResurtido.findFirst({
    where: {
      plu: p.plu,
      estado: { not: 'COMPLETADA' },
      montaje: { operarioId: operario.id, estado: 'EN_CURSO', deletedAt: null },
    },
    orderBy: { orden: 'asc' },
    select: { id: true, unidadesPendientes: true },
  })

  const now = new Date()
  const actualizado = await prisma.$transaction(async (tx) => {
    // Reasignar uno que ya estaba en marcha: el tramo de quien lo tenia se
    // cierra y el nuevo operario empieza desde cero, escaneando.
    await cerrarTramoPendiente(tx, id, now)
    await tx.pendienteGourmet.update({
      where: { id },
      data: {
        estado: 'ASIGNADO',
        horaInicio: null,
        horaFin: null,
        operarioId: operario.id,
        asignadoPorId: actor.id,
        asignadoAt: now,
        // Reasignar limpia la novedad: alguien ya decidio que hacer con ella.
        tipoNovedad: null,
        novedadAt: null,
        novedadPorId: null,
        ...(tarea && { tareaResurtidoId: tarea.id }),
      },
    })

    if (tarea) {
      await tx.tareaResurtido.update({
        where: { id: tarea.id },
        data: {
          prioridad: true,
          unidadesPendientes: tarea.unidadesPendientes + p.unidadesSolicitadas,
        },
      })
      await avisar(tx, [operario.id], {
        tipo: 'PENDIENTE_ASIGNADO',
        titulo: 'Prioridad en tu resurtido',
        descripcion: `Suma ${p.unidadesSolicitadas} de ${p.descripcion} a una tarea que ya tenias`,
        enlace: '/dashboard/resurtido',
      })
      // Quien lo pidio se entera de que ya va en camino con el resurtido.
      await avisar(tx, [p.solicitadoPorId], {
        tipo: 'PENDIENTE_EN_RESURTIDO',
        titulo: 'Tu pendiente va con el resurtido',
        descripcion: `${p.descripcion} se sumo al resurtido de ${operario.name}`,
        enlace: '/dashboard/pendientes',
      })
    } else {
      await avisar(tx, [operario.id], {
        tipo: 'PENDIENTE_ASIGNADO',
        titulo: 'Tienes un pendiente prioritario',
        descripcion: `${p.unidadesSolicitadas} de ${p.descripcion}`,
        enlace: '/dashboard/resurtido',
      })
    }

    return tx.pendienteGourmet.findUniqueOrThrow({ where: { id }, include: PENDIENTE_INCLUDE })
  })

  await prisma.activityLog.create({
    data: {
      userId: actor.id, action: 'UPDATE', module: 'pendientes',
      recordId: id,
      details: tarea
        ? `Pendiente sumado al resurtido de ${operario.name}`
        : `Pendiente asignado a ${operario.name}`,
    },
  }).catch(() => {})

  return { success: true, data: mapPendiente(actualizado) }
})
