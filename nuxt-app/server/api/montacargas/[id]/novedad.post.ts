import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapMovimientoMontacargas } from '../../../utils/mapRow'
import {
  assertUsuarioMontacargas, cerrarTramoAbierto, esResponsableOGestor, MOVIMIENTO_INCLUDE,
} from '../../../utils/montacargas'
import { normalizarUbicacion } from '../../../utils/montacargasCalc'

const schema = z.object({
  tipo: z.enum(['UNIDADES', 'UBICACION_INICIAL']),
  detalle: z.string().max(500).optional(),
  // Lo que el ayudante encontro de verdad, para que quien verifica vea el
  // descuadre sin tener que preguntar.
  cantidadEncontrada: z.number().int().min(0).optional(),
  ubicacionEncontrada: z.string().max(120).optional(),
})

// POST /api/montacargas/:id/novedad - el ayudante marca que no cuadra.
//
// DETIENE EL RELOJ: cierra el tramo abierto y deja el registro en NOVEDAD. La
// verificacion no se cronometra a proposito - es un proceso de revision, no de
// operacion, y cronometrarlo castigaria al operario por un problema ajeno.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioMontacargas(actor.role)

  const id = getRouterParam(event, 'id')!
  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const d = parsed.data

  const record = await prisma.movimientoMontacargas.findUnique({
    where: { id },
    select: { responsableId: true, estado: true, deletedAt: true, plu: true },
  })
  if (!record || record.deletedAt) {
    throw createError({ statusCode: 404, statusMessage: 'Registro no encontrado' })
  }
  if (!esResponsableOGestor(actor, record)) {
    throw createError({ statusCode: 403, statusMessage: 'El registro no esta en tus manos' })
  }
  if (record.estado !== 'EN_CURSO') {
    throw createError({
      statusCode: 409,
      statusMessage: record.estado === 'CERRADO'
        ? 'El registro ya esta cerrado'
        : 'El registro ya tiene una novedad abierta',
    })
  }

  const now = new Date()
  const updated = await prisma.$transaction(async (tx) => {
    await cerrarTramoAbierto(tx, id, now)
    await tx.novedadMontacargas.create({
      data: {
        movimientoId: id,
        tipo: d.tipo,
        detalle: d.detalle?.trim() || null,
        cantidadEncontrada: d.cantidadEncontrada ?? null,
        ubicacionEncontrada: d.ubicacionEncontrada
          ? normalizarUbicacion(d.ubicacionEncontrada)
          : null,
        abiertaPorId: actor.id,
        abiertaAt: now,
      },
    })
    await tx.movimientoMontacargas.update({
      where: { id },
      data: { estado: 'NOVEDAD', actualizadoPorId: actor.id },
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
      details: `Novedad ${d.tipo} en PLU ${record.plu} - reloj detenido`,
    },
  }).catch(() => {})

  return { success: true, data: mapMovimientoMontacargas(updated) }
})
