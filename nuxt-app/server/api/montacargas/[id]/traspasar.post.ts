import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapMovimientoMontacargas } from '../../../utils/mapRow'
import {
  abrirTramo, assertUsuarioMontacargas, cerrarTramoAbierto, esResponsableOGestor,
  MOVIMIENTO_INCLUDE,
} from '../../../utils/montacargas'
import { puedeRecibirTraspaso, validarCantidades } from '../../../utils/montacargasCalc'

const schema = z.object({ ayudanteId: z.string().min(1) })

// POST /api/montacargas/:id/traspasar - pasa el PLU a un ayudante.
//
// Cierra el tramo de quien lo tenia y abre el del ayudante: el tiempo del
// primero para ahi y el del segundo empieza en ese instante. Asi la
// productividad no se le carga entera a quien lo empezo.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioMontacargas(actor.role)

  const id = getRouterParam(event, 'id')!
  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const { ayudanteId } = parsed.data

  const record = await prisma.movimientoMontacargas.findUnique({
    where: { id },
    select: {
      responsableId: true, estado: true, deletedAt: true, plu: true,
      cajas: true, unidadesPorCaja: true, hayReguero: true, unidadesSueltas: true,
    },
  })
  if (!record || record.deletedAt) {
    throw createError({ statusCode: 404, statusMessage: 'Registro no encontrado' })
  }
  if (!esResponsableOGestor(actor, record)) {
    throw createError({ statusCode: 403, statusMessage: 'El registro ya no esta en tus manos' })
  }
  if (record.estado !== 'EN_CURSO') {
    throw createError({
      statusCode: 409,
      statusMessage: record.estado === 'CERRADO'
        ? 'El registro ya esta cerrado'
        : 'El registro tiene una novedad sin resolver',
    })
  }
  if (record.responsableId === ayudanteId) {
    throw createError({ statusCode: 400, statusMessage: 'El registro ya esta en manos de esa persona' })
  }

  // El ayudante recibe una cifra que debe cuadrar contra lo fisico, asi que
  // traspasar sin cantidades no tendria nada que confirmar.
  const faltan = validarCantidades(record)
  if (faltan) {
    throw createError({
      statusCode: 400,
      statusMessage: `Completa las cantidades antes de pasar el PLU: ${faltan.toLowerCase()}`,
    })
  }

  const ayudante = await prisma.user.findUnique({
    where: { id: ayudanteId },
    select: { id: true, name: true, role: true, active: true },
  })
  // Un montacarguista tambien puede recibir: hace de ayudante cuando hace falta.
  if (!ayudante || !ayudante.active || !puedeRecibirTraspaso(ayudante.role)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'El destinatario no puede recibir PLUs: debe ser un operario de almacenamiento o un montacarguista activo',
    })
  }

  const now = new Date()
  const updated = await prisma.$transaction(async (tx) => {
    const orden = await cerrarTramoAbierto(tx, id, now)
    await abrirTramo(tx, id, ayudanteId, now, orden + 1)
    await tx.movimientoMontacargas.update({
      where: { id },
      data: { responsableId: ayudanteId, actualizadoPorId: actor.id },
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
      details: `PLU ${record.plu} pasado a ${ayudante.name}`,
    },
  }).catch(() => {})

  return { success: true, data: mapMovimientoMontacargas(updated) }
})
