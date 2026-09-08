import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapMovimientoMontacargas } from '../../../utils/mapRow'
import { assertUsuarioMontacargas, MOVIMIENTO_INCLUDE, resolverProducto } from '../../../utils/montacargas'
import {
  calcularCantidadTotal, normalizarUbicacion, puedeGestionarMontacargas,
} from '../../../utils/montacargasCalc'

// Correccion a posteriori. El flujo normal del operario NO pasa por aqui:
// abrir es POST /, completar cantidades es PATCH /:id/cantidades y cerrar es
// POST /:id/ubicacion. Esto existe para arreglar un registro ya guardado.

const patchSchema = z.object({
  codigo: z.string().min(1).max(100).optional(),
  cajas: z.number().int().min(0).optional(),
  unidadesPorCaja: z.number().int().min(1).optional(),
  hayReguero: z.boolean().optional(),
  unidadesSueltas: z.number().int().min(0).optional(),
  ubicacionInicial: z.string().max(120).optional(),
  ubicacionFinal: z.string().min(1).max(120).optional(),
  horaInicio: z.string().datetime().optional(),
  horaFinalizacion: z.string().datetime().nullable().optional(),
  motivoCorreccion: z.string().min(5).optional(),
})

// PATCH /api/montacargas/:id - correccion. El dueno arregla sus datos; solo
// supervision toca las horas, y siempre con motivo (es la metrica de
// productividad: sin traza, editarla la vuelve inutil).
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioMontacargas(actor.role)

  const id = getRouterParam(event, 'id')!
  const parsed = patchSchema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const d = parsed.data

  const current = await prisma.movimientoMontacargas.findUnique({
    where: { id },
    select: {
      deletedAt: true, creadoPorId: true, responsableId: true, cajas: true,
      unidadesPorCaja: true, unidadesSueltas: true,
    },
  })
  if (!current || current.deletedAt) {
    throw createError({ statusCode: 404, statusMessage: 'Registro no encontrado' })
  }

  const isGestor = puedeGestionarMontacargas(actor.role)
  if (!isGestor && current.creadoPorId !== actor.id && current.responsableId !== actor.id) {
    throw createError({ statusCode: 403, statusMessage: 'Solo puedes editar tus propios registros' })
  }

  const cambiaHoras = d.horaInicio !== undefined || d.horaFinalizacion !== undefined
  if (cambiaHoras && !isGestor) {
    throw createError({ statusCode: 403, statusMessage: 'Solo supervision puede modificar las horas' })
  }
  if (cambiaHoras && !d.motivoCorreccion?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Motivo de correccion obligatorio para modificar horas' })
  }

  const data: Record<string, unknown> = {
    actualizadoPorId: actor.id,
    ...(d.cajas !== undefined && { cajas: d.cajas }),
    ...(d.unidadesPorCaja !== undefined && { unidadesPorCaja: d.unidadesPorCaja, unidadesManuales: true }),
    ...(d.hayReguero !== undefined && { hayReguero: d.hayReguero }),
    ...(d.unidadesSueltas !== undefined && { unidadesSueltas: d.unidadesSueltas }),
    ...(d.ubicacionInicial !== undefined && { ubicacionInicial: normalizarUbicacion(d.ubicacionInicial) }),
    ...(d.ubicacionFinal !== undefined && { ubicacionFinal: normalizarUbicacion(d.ubicacionFinal) }),
    ...(d.horaInicio !== undefined && { horaInicio: new Date(d.horaInicio) }),
    ...(d.horaFinalizacion !== undefined && {
      horaFinalizacion: d.horaFinalizacion ? new Date(d.horaFinalizacion) : null,
    }),
    ...(d.motivoCorreccion !== undefined && { motivoCorreccion: d.motivoCorreccion.trim() }),
  }

  if (d.codigo !== undefined) {
    const producto = await resolverProducto(d.codigo)
    if (!producto?.descripcion?.trim()) {
      throw createError({ statusCode: 404, statusMessage: 'PLU o codigo de barras no encontrado en el maestro' })
    }
    data.plu = producto.plu
    data.ean = producto.ean
    data.descripcion = producto.descripcion.trim()
  }

  // cantidadTotal es derivado y persistido: hay que recalcularlo si cambio
  // cualquiera de sus factores, o la tabla y el Excel quedan mintiendo.
  if (d.cajas !== undefined || d.unidadesPorCaja !== undefined || d.unidadesSueltas !== undefined) {
    data.cantidadTotal = calcularCantidadTotal(
      d.cajas ?? current.cajas,
      d.unidadesPorCaja ?? current.unidadesPorCaja,
      d.unidadesSueltas ?? current.unidadesSueltas,
    )
  }

  const row = await prisma.movimientoMontacargas.update({
    where: { id },
    data: data as never,
    include: MOVIMIENTO_INCLUDE,
  })

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: 'UPDATE',
      module: 'control-montacargas',
      recordId: id,
      details: d.motivoCorreccion ?? 'Correccion de registro de montacargas',
    },
  }).catch(() => {})

  return { success: true, data: mapMovimientoMontacargas(row) }
})
