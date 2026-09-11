import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapMontaje } from '../../../utils/mapRow'
import { assertEjecutor, avisar, idsAlmacenamiento, MONTAJE_INCLUDE } from '../../../utils/resurtido'
import { validarCierreTarea, validarEscaneoPlu } from '../../../utils/resurtidoCalc'
// normalizarUbicacion es del modulo de montacargas: una sola forma de escribir
// una ubicacion en todo el proyecto.
import { normalizarUbicacion } from '../../../utils/montacargasCalc'

const schema = z.object({
  plu: z.string().min(1).max(100),
  unidadesBajadas: z.number().int(),
  pickingFinal: z.string().min(1).max(120),
})

/**
 * POST /api/resurtido-tareas/:id/completar - CIERRA EL RELOJ de la tarea.
 *
 * Las unidades bajadas pueden no coincidir con las solicitadas: dependen del
 * espacio que quede en el picking. El picking final llega sugerido por el
 * archivo pero se puede cambiar, porque el hueco real manda sobre el papel.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertEjecutor(actor.role)

  const id = getRouterParam(event, 'id')!
  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const d = parsed.data

  const tarea = await prisma.tareaResurtido.findUnique({
    where: { id },
    include: { montaje: { select: { id: true, operarioId: true, deletedAt: true, creadoPorId: true } } },
  })
  if (!tarea || tarea.montaje.deletedAt) {
    throw createError({ statusCode: 404, statusMessage: 'Tarea no encontrada' })
  }
  if (tarea.montaje.operarioId !== actor.id) {
    throw createError({ statusCode: 403, statusMessage: 'Esa tarea es de otro operario' })
  }
  if (tarea.estado === 'COMPLETADA') {
    throw createError({ statusCode: 409, statusMessage: 'Esa tarea ya esta completada' })
  }
  if (!tarea.horaInicio) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Primero escanea la ubicacion: es lo que arranca el reloj',
    })
  }

  const errPlu = validarEscaneoPlu(d.plu, tarea.plu)
  if (errPlu) throw createError({ statusCode: 400, statusMessage: errPlu })

  const errCierre = validarCierreTarea({
    unidadesBajadas: d.unidadesBajadas,
    pickingFinal: d.pickingFinal,
  })
  if (errCierre) throw createError({ statusCode: 400, statusMessage: errCierre })

  const now = new Date()
  const montaje = await prisma.$transaction(async (tx) => {
    await tx.tareaResurtido.update({
      where: { id },
      data: {
        estado: 'COMPLETADA',
        unidadesBajadas: d.unidadesBajadas,
        pickingFinal: normalizarUbicacion(d.pickingFinal),
        horaFin: now,
      },
    })

    // Los pendientes que iban DENTRO de esta tarea quedan ubicados con ella: es
    // la misma bajada. Y se avisa, que es justo lo que estaban esperando.
    const enTarea = await tx.pendienteGourmet.findMany({
      where: { tareaResurtidoId: id, estado: { not: 'COMPLETADO' }, deletedAt: null },
      select: { id: true, descripcion: true, solicitadoPorId: true, asignadoPorId: true, unidadesSolicitadas: true },
    })
    const ubicacion = normalizarUbicacion(d.pickingFinal)
    for (const pen of enTarea) {
      await tx.pendienteGourmet.update({
        where: { id: pen.id },
        data: {
          estado: 'COMPLETADO',
          unidadesBajadas: pen.unidadesSolicitadas,
          ubicacionFinal: ubicacion,
          horaInicio: tarea.horaInicio,
          horaFin: now,
          completadoAt: now,
        },
      })
      await avisar(tx, [
        pen.solicitadoPorId,
        ...(pen.asignadoPorId ? [pen.asignadoPorId] : []),
        ...(await idsAlmacenamiento()),
      ], {
        tipo: 'PENDIENTE_COMPLETADO',
        titulo: 'Pendiente ubicado',
        descripcion: `${pen.descripcion} en ${ubicacion}, con el resurtido`,
        enlace: '/dashboard/pendientes',
      })
    }

    // El montaje se cierra solo cuando ya no queda ninguna tarea por hacer.
    const quedan = await tx.tareaResurtido.count({
      where: { montajeId: tarea.montaje.id, estado: { not: 'COMPLETADA' } },
    })
    if (quedan === 0) {
      await tx.montajeResurtido.update({
        where: { id: tarea.montaje.id },
        data: { estado: 'COMPLETADO', completadoAt: now },
      })
      await avisar(tx, [tarea.montaje.creadoPorId], {
        tipo: 'RESURTIDO_COMPLETADO',
        titulo: 'Resurtido completado',
        descripcion: `${actor.name ?? 'El operario'} termino todas las tareas del resurtido`,
        enlace: '/dashboard/montaje-resurtido',
      })
    }

    return tx.montajeResurtido.findUniqueOrThrow({
      where: { id: tarea.montaje.id },
      include: MONTAJE_INCLUDE,
    })
  })

  return { success: true, data: mapMontaje(montaje) }
})
