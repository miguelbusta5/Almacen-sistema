import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapMovimientoMontacargas } from '../../../utils/mapRow'
import { assertUsuarioMontacargas, MOVIMIENTO_INCLUDE } from '../../../utils/montacargas'
import { normalizarUbicacion, validarUbicacion } from '../../../utils/montacargasCalc'

const schema = z.object({ ubicacionFinal: z.string().min(1).max(120) })

// POST /api/montacargas/:id/ubicacion - asigna el deposito final y PARA EL RELOJ.
// Asignar la ubicacion final es lo que cierra el registro: no hay un "finalizar"
// aparte.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioMontacargas(actor.role)

  const id = getRouterParam(event, 'id')!
  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }

  const ubicacionFinal = normalizarUbicacion(parsed.data.ubicacionFinal)
  const validation = validarUbicacion(ubicacionFinal)
  if (validation) throw createError({ statusCode: 400, statusMessage: validation })

  const record = await prisma.movimientoMontacargas.findUnique({
    where: { id },
    select: { creadoPorId: true, horaFinalizacion: true, deletedAt: true },
  })
  if (!record || record.deletedAt) {
    throw createError({ statusCode: 404, statusMessage: 'Registro no encontrado' })
  }
  if (record.creadoPorId !== actor.id) {
    throw createError({ statusCode: 403, statusMessage: 'Solo puedes cerrar tus propios registros' })
  }
  if (record.horaFinalizacion) {
    throw createError({ statusCode: 409, statusMessage: 'El registro ya esta cerrado' })
  }

  const updated = await prisma.movimientoMontacargas.update({
    where: { id },
    data: { ubicacionFinal, horaFinalizacion: new Date(), actualizadoPorId: actor.id },
    include: MOVIMIENTO_INCLUDE,
  })

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: 'UPDATE',
      module: 'control-montacargas',
      recordId: id,
      details: `Ubicacion final asignada: ${ubicacionFinal}`,
    },
  }).catch(() => {})

  return { success: true, data: mapMovimientoMontacargas(updated) }
})
