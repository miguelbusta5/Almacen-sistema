import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapEstiba } from '../../../utils/mapRow'
import { assertUsuarioEstibas, ESTIBA_INCLUDE, resolverProducto } from '../../../utils/estibas'
import {
  calcularCantidadTotal, normalizarPedido, normalizarUbicacion, puedeGestionarEstibas,
} from '../../../utils/estibasCalc'

const patchSchema = z.object({
  pedido: z.string().min(1).max(50).optional(),
  codigo: z.string().min(1).max(100).optional(),
  cajas: z.number().int().min(1).optional(),
  unidadesPorCaja: z.number().int().min(1).optional(),
  ubicacion: z.string().min(1).max(120).optional(),
  horaInicio: z.string().datetime().optional(),
  horaFinalizacion: z.string().datetime().nullable().optional(),
  motivoCorreccion: z.string().min(5).optional(),
})

// PATCH /api/estibas/:id — corrección. El dueño arregla sus datos; solo
// supervisión toca las horas, y siempre con motivo (es la métrica de
// productividad: sin traza, editarla la vuelve inútil).
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioEstibas(actor.role)

  const id = getRouterParam(event, 'id')!
  const parsed = patchSchema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const d = parsed.data

  const current = await prisma.estiba.findUnique({
    where: { id },
    select: { deletedAt: true, creadoPorId: true, cajas: true, unidadesPorCaja: true },
  })
  if (!current || current.deletedAt) throw createError({ statusCode: 404, statusMessage: 'Estiba no encontrada' })

  const isGestor = puedeGestionarEstibas(actor.role)
  if (!isGestor && current.creadoPorId !== actor.id) {
    throw createError({ statusCode: 403, statusMessage: 'Solo puedes editar tus propias estibas' })
  }

  const cambiaHoras = d.horaInicio !== undefined || d.horaFinalizacion !== undefined
  if (cambiaHoras && !isGestor) {
    throw createError({ statusCode: 403, statusMessage: 'Solo supervisión puede modificar las horas' })
  }
  if (cambiaHoras && !d.motivoCorreccion?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Motivo de correccion obligatorio para modificar horas' })
  }

  const data: Record<string, unknown> = {
    actualizadoPorId: actor.id,
    ...(d.pedido !== undefined && { pedido: normalizarPedido(d.pedido) }),
    ...(d.cajas !== undefined && { cajas: d.cajas }),
    ...(d.unidadesPorCaja !== undefined && { unidadesPorCaja: d.unidadesPorCaja, unidadesManuales: true }),
    ...(d.ubicacion !== undefined && { ubicacion: normalizarUbicacion(d.ubicacion) }),
    ...(d.horaInicio !== undefined && { horaInicio: new Date(d.horaInicio) }),
    ...(d.horaFinalizacion !== undefined && {
      horaFinalizacion: d.horaFinalizacion ? new Date(d.horaFinalizacion) : null,
    }),
    ...(d.motivoCorreccion !== undefined && { motivoCorreccion: d.motivoCorreccion.trim() }),
  }

  if (d.codigo !== undefined) {
    const producto = await resolverProducto(d.codigo)
    if (!producto?.descripcion?.trim()) {
      throw createError({ statusCode: 404, statusMessage: 'PLU o código de barras no encontrado en el maestro' })
    }
    data.plu = producto.plu
    data.ean = producto.ean
    data.descripcion = producto.descripcion.trim()
  }

  // cantidadTotal es derivado y persistido: hay que recalcularlo si cambió
  // cualquiera de sus dos factores, o la tabla y el Excel quedan mintiendo.
  if (d.cajas !== undefined || d.unidadesPorCaja !== undefined) {
    data.cantidadTotal = calcularCantidadTotal(
      d.cajas ?? current.cajas,
      d.unidadesPorCaja ?? current.unidadesPorCaja,
    )
  }

  const row = await prisma.estiba.update({ where: { id }, data: data as never, include: ESTIBA_INCLUDE })

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: 'UPDATE',
      module: 'estibas',
      recordId: id,
      details: d.motivoCorreccion ?? 'Correccion de estiba',
    },
  }).catch(() => {})

  return { success: true, data: mapEstiba(row) }
})
