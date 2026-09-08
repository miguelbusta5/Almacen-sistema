import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapMovimientoMontacargas } from '../../../utils/mapRow'
import {
  abrirTramo, assertUsuarioMontacargas, cerrarTramoAbierto, MOVIMIENTO_INCLUDE,
} from '../../../utils/montacargas'
import { calcularCantidadTotal, esAyudante } from '../../../utils/montacargasCalc'

const schema = z.object({
  nota: z.string().min(3).max(500),
  // Correccion opcional de lo verificado. La hace quien verifica, no el ayudante.
  cajas: z.number().int().min(0).optional(),
  unidadesPorCaja: z.number().int().min(1).optional(),
  unidadesSueltas: z.number().int().min(0).optional(),
  ubicacionInicial: z.string().max(120).optional(),
})

// POST /api/montacargas/:id/resolver-novedad - se verifico y queda resuelta.
//
// Reanuda el reloj abriendo un tramo nuevo para quien tiene el PLU: la ventana
// de verificacion queda fuera del tiempo medido (no se cronometra), pero lo que
// falte de almacenar si se mide.
//
// El ayudante no resuelve su propia novedad: quien confirma es el montacarguista
// o supervision, que es el sentido de "los usuarios entran y confirman".
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioMontacargas(actor.role)
  if (esAyudante(actor.role)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'La novedad la confirma el montacarguista o supervision',
    })
  }

  const id = getRouterParam(event, 'id')!
  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const d = parsed.data

  const record = await prisma.movimientoMontacargas.findUnique({
    where: { id },
    select: {
      estado: true, deletedAt: true, plu: true, responsableId: true,
      cajas: true, unidadesPorCaja: true, unidadesSueltas: true,
    },
  })
  if (!record || record.deletedAt) {
    throw createError({ statusCode: 404, statusMessage: 'Registro no encontrado' })
  }
  if (record.estado !== 'NOVEDAD') {
    throw createError({ statusCode: 409, statusMessage: 'El registro no tiene una novedad abierta' })
  }

  const cajas = d.cajas ?? record.cajas
  const unidadesPorCaja = d.unidadesPorCaja ?? record.unidadesPorCaja
  const unidadesSueltas = d.unidadesSueltas ?? record.unidadesSueltas

  const now = new Date()
  const updated = await prisma.$transaction(async (tx) => {
    await tx.novedadMontacargas.updateMany({
      where: { movimientoId: id, resueltaAt: null },
      data: { resueltaPorId: actor.id, resueltaAt: now, notaResolucion: d.nota.trim() },
    })
    // El reloj se reanuda para quien tiene el PLU en la mano.
    const orden = await cerrarTramoAbierto(tx, id, now)
    await abrirTramo(tx, id, record.responsableId, now, orden + 1)
    await tx.movimientoMontacargas.update({
      where: { id },
      data: {
        estado: 'EN_CURSO',
        cajas,
        unidadesPorCaja,
        unidadesSueltas,
        hayReguero: unidadesSueltas > 0,
        cantidadTotal: calcularCantidadTotal(cajas, unidadesPorCaja, unidadesSueltas),
        ...(d.ubicacionInicial !== undefined && { ubicacionInicial: d.ubicacionInicial }),
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
      details: `Novedad resuelta en PLU ${record.plu}: ${d.nota.trim()}`,
    },
  }).catch(() => {})

  return { success: true, data: mapMovimientoMontacargas(updated) }
})
