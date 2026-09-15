import { defineOperacionAlmacenHandler } from '../../../utils/operacionAlmacen'
import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapMovimientoMontacargas } from '../../../utils/mapRow'
import {
  assertUsuarioMontacargas, esResponsableOGestor, MOVIMIENTO_INCLUDE,
} from '../../../utils/montacargas'
import { calcularCantidadTotal, recibioTraspaso } from '../../../utils/montacargasCalc'

const schema = z.object({
  cajas: z.number().int().min(0),
  unidadesPorCaja: z.number().int().min(1),
  hayReguero: z.boolean().optional(),
  unidadesSueltas: z.number().int().min(0).optional(),
})

// PATCH /api/montacargas/:id/cantidades - completa las cantidades sin parar el
// reloj. Es el paso intermedio entre abrir (PLU) y cerrar (ubicacion).
//
// Quien RECIBIO el PLU no entra aqui: no corrige lo que le pasaron. Si no
// cuadra, abre una novedad (POST /:id/novedad).
//
// La guarda mira el REGISTRO y no el rol: desde que un montacarguista tambien
// puede recibir un traspaso, el rol ya no dice en que modo esta.
export default defineOperacionAlmacenHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioMontacargas(actor.role)

  const id = getRouterParam(event, 'id')!
  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const d = parsed.data

  const current = await prisma.movimientoMontacargas.findUnique({
    where: { id },
    select: { deletedAt: true, responsableId: true, creadoPorId: true, estado: true },
  })
  if (!current || current.deletedAt) {
    throw createError({ statusCode: 404, statusMessage: 'Registro no encontrado' })
  }
  if (!esResponsableOGestor(actor, current)) {
    throw createError({ statusCode: 403, statusMessage: 'El registro ya no esta en tus manos' })
  }
  if (recibioTraspaso(current, actor.id)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'No se corrige un PLU que te pasaron: si no cuadra, marca una novedad',
    })
  }
  if (current.estado === 'CERRADO') {
    throw createError({ statusCode: 409, statusMessage: 'El registro ya esta cerrado' })
  }

  const hayReguero = d.hayReguero ?? false
  const unidadesSueltas = hayReguero ? (d.unidadesSueltas ?? 0) : 0

  const row = await prisma.movimientoMontacargas.update({
    where: { id },
    data: {
      cajas: d.cajas,
      unidadesPorCaja: d.unidadesPorCaja,
      hayReguero,
      unidadesSueltas,
      cantidadTotal: calcularCantidadTotal(d.cajas, d.unidadesPorCaja, unidadesSueltas),
      actualizadoPorId: actor.id,
    },
    include: MOVIMIENTO_INCLUDE,
  })

  return { success: true, data: mapMovimientoMontacargas(row) }
})
