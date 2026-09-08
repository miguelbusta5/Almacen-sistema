import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapMovimientoMontacargas } from '../../../utils/mapRow'
import {
  assertUsuarioMontacargas, cerrarTramoAbierto, esResponsableOGestor, MOVIMIENTO_INCLUDE,
} from '../../../utils/montacargas'
import { normalizarUbicacion, validarCantidades, validarUbicacion } from '../../../utils/montacargasCalc'

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
    select: {
      responsableId: true, estado: true, deletedAt: true,
      cajas: true, unidadesPorCaja: true, hayReguero: true, unidadesSueltas: true,
    },
  })
  if (!record || record.deletedAt) {
    throw createError({ statusCode: 404, statusMessage: 'Registro no encontrado' })
  }
  if (!esResponsableOGestor(actor, record)) {
    throw createError({ statusCode: 403, statusMessage: 'Solo puedes cerrar los registros que tienes en la mano' })
  }
  if (record.estado === 'CERRADO') {
    throw createError({ statusCode: 409, statusMessage: 'El registro ya esta cerrado' })
  }
  if (record.estado === 'NOVEDAD') {
    throw createError({
      statusCode: 409,
      statusMessage: 'El registro tiene una novedad sin resolver: primero hay que verificarlo',
    })
  }

  // Las cantidades se exigen aqui y no al abrir: al abrir solo se tiene el PLU.
  const faltan = validarCantidades(record)
  if (faltan) throw createError({ statusCode: 400, statusMessage: faltan })

  const now = new Date()
  const updated = await prisma.$transaction(async (tx) => {
    await cerrarTramoAbierto(tx, id, now)
    await tx.movimientoMontacargas.update({
      where: { id },
      data: {
        ubicacionFinal,
        estado: 'CERRADO',
        horaFinalizacion: now,
        actualizadoPorId: actor.id,
      },
    })
    return tx.movimientoMontacargas.findUniqueOrThrow({
      where: { id },
      include: MOVIMIENTO_INCLUDE,
    })
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
