import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { auditar, destinoDeTienda, ordenPorId, ORDEN_INCLUDE, requireInspeccion } from '../../../utils/muebles'
import { normalizarCiudad, validarCiudad } from '../../../utils/mueblesCalc'
import { mapOrdenMuebles } from '../../../utils/mapRow'

const schema = z.object({
  inspectorId: z.string().min(1),
  /** Tienda destino del maestro: de ella sale la ciudad (E-commerce la pide). */
  tiendaCodigo: z.string().min(1).max(50).optional(),
  ciudad: z.string().max(80).nullable().optional(),
})

/**
 * POST /api/inspeccion-muebles/:id/ciudad - a que ciudad va la orden.
 *
 * Se pide al empezar a inspeccionar porque es lo que despues usa el patinador
 * para agrupar las entregas a transporte. Se escribe a mano pero se guarda
 * normalizada (ver normalizarCiudad): si no, el filtro se parte entre
 * "medellin", "Medellín" y "MEDELLIN ".
 */
export default defineEventHandler(async (event) => {
  const actor = await requireInspeccion(event)
  const id = getRouterParam(event, 'id')!

  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Elige la tienda destino' })

  // Por tienda (25-09); la ciudad sola queda para clientes viejos en cache.
  let destino: { tiendaDestinoCodigo: string | null; tiendaDestinoNombre: string | null; ciudadEnvio: string }
  if (parsed.data.tiendaCodigo) {
    destino = await destinoDeTienda(parsed.data.tiendaCodigo, parsed.data.ciudad)
  } else {
    const error = validarCiudad(parsed.data.ciudad)
    if (error) throw createError({ statusCode: 400, statusMessage: error })
    destino = { tiendaDestinoCodigo: null, tiendaDestinoNombre: null, ciudadEnvio: normalizarCiudad(parsed.data.ciudad) }
  }
  const ciudad = destino.ciudadEnvio

  const orden = await ordenPorId(id)
  if (orden.estado === 'ENTREGADA_TRANSPORTE') {
    throw createError({ statusCode: 409, statusMessage: 'Esa orden ya se entregó a transporte' })
  }

  const inspector = await prisma.inspector.findFirst({
    where: { id: parsed.data.inspectorId, activo: true },
    select: { id: true, nombre: true },
  })
  if (!inspector) throw createError({ statusCode: 404, statusMessage: 'Inspector no encontrado' })

  const actualizada = await prisma.ordenMuebles.update({
    where: { id: orden.id },
    data: destino,
    include: ORDEN_INCLUDE,
  })

  const donde = destino.tiendaDestinoNombre ? `${destino.tiendaDestinoNombre} (${ciudad})` : ciudad
  const antes = orden.ciudadEnvio ? ` (antes ${orden.tiendaDestinoNombre ? `${orden.tiendaDestinoNombre} · ` : ''}${orden.ciudadEnvio})` : ''
  await auditar(actor.id, 'UPDATE', 'inspeccion-muebles', orden.id, `${orden.codigo} va a ${donde}${antes} — ${inspector.nombre}`)

  return { success: true, data: mapOrdenMuebles(actualizada) }
})
