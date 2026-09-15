import { defineOperacionAlmacenHandler } from '../../../utils/operacionAlmacen'
import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapPendiente } from '../../../utils/mapRow'
import {
  abrirTramoPendiente, assertEjecutor, avisar, cerrarTramoPendiente, idsAlmacenamiento, PENDIENTE_INCLUDE,
} from '../../../utils/resurtido'
import { validarCierrePendiente } from '../../../utils/resurtidoCalc'
// normalizarUbicacion es del modulo de montacargas: una sola forma de escribir
// una ubicacion en todo el proyecto.
import { normalizarUbicacion } from '../../../utils/montacargasCalc'

const schema = z.object({
  unidadesBajadas: z.number().int(),
  ubicacionFinal: z.string().min(1).max(120),
})

/**
 * POST /api/pendientes/:id/completar - CIERRA EL RELOJ y avisa.
 *
 * Escribir la ubicacion final es lo que da el pendiente por ubicado, y de ahi
 * sale el aviso a quien lo pidio y a quien lo repartio: es justo el dato que
 * estaban esperando.
 */
export default defineOperacionAlmacenHandler(async (event) => {
  const actor = await requireAuth(event)
  assertEjecutor(actor.role)

  const id = getRouterParam(event, 'id')!
  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const d = parsed.data

  const p = await prisma.pendienteGourmet.findUnique({
    where: { id },
    select: {
      estado: true, deletedAt: true, operarioId: true, horaInicio: true,
      descripcion: true, solicitadoPorId: true, asignadoPorId: true, pasadoPorId: true,
      tramos: { select: { id: true } },
    },
  })
  if (!p || p.deletedAt) throw createError({ statusCode: 404, statusMessage: 'Pendiente no encontrado' })
  if (p.operarioId !== actor.id) {
    throw createError({ statusCode: 403, statusMessage: 'Ese pendiente es de otro operario' })
  }
  if (p.estado === 'COMPLETADO') {
    throw createError({ statusCode: 409, statusMessage: 'Ese pendiente ya se ubico' })
  }
  if (!p.horaInicio) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Primero escanea el PLU: es lo que arranca el reloj',
    })
  }

  const error = validarCierrePendiente(d)
  if (error) throw createError({ statusCode: 400, statusMessage: error })

  const ubicacion = normalizarUbicacion(d.ubicacionFinal)
  const now = new Date()

  const actualizado = await prisma.$transaction(async (tx) => {
    // Uno empezado antes de que existieran los tramos: todo su tiempo es de
    // quien lo cierra.
    if (p.tramos.length === 0) await abrirTramoPendiente(tx, id, actor.id, p.horaInicio!)
    await cerrarTramoPendiente(tx, id, now)
    await tx.pendienteGourmet.update({
      where: { id },
      data: {
        estado: 'COMPLETADO',
        unidadesBajadas: d.unidadesBajadas,
        ubicacionFinal: ubicacion,
        horaFin: now,
        completadoAt: now,
      },
    })

    // Quien lo pidio, quien lo repartio y el resto de almacenamiento.
    const destinatarios = [
      p.solicitadoPorId,
      ...(p.asignadoPorId ? [p.asignadoPorId] : []),
      // Quien lo empezo y se lo paso al ayudante tambien quiere saber que cerro.
      ...(p.pasadoPorId && p.pasadoPorId !== actor.id ? [p.pasadoPorId] : []),
      ...(await idsAlmacenamiento()),
    ]
    await avisar(tx, destinatarios, {
      tipo: 'PENDIENTE_COMPLETADO',
      titulo: 'Pendiente ubicado',
      descripcion: `${d.unidadesBajadas} de ${p.descripcion} en ${ubicacion}`,
      enlace: '/dashboard/pendientes',
    })

    return tx.pendienteGourmet.findUniqueOrThrow({ where: { id }, include: PENDIENTE_INCLUDE })
  })

  await prisma.activityLog.create({
    data: {
      userId: actor.id, action: 'UPDATE', module: 'pendientes',
      recordId: id, details: `Pendiente ubicado en ${ubicacion} con ${d.unidadesBajadas} unidades`,
    },
  }).catch(() => {})

  return { success: true, data: mapPendiente(actualizado) }
})
