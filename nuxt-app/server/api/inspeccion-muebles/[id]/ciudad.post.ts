import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { auditar, ordenPorId, ORDEN_INCLUDE, requireInspeccion } from '../../../utils/muebles'
import { normalizarCiudad, validarCiudad } from '../../../utils/mueblesCalc'
import { mapOrdenMuebles } from '../../../utils/mapRow'

const schema = z.object({ inspectorId: z.string().min(1), ciudad: z.string().min(1).max(80) })

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
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Escribe la ciudad de envío' })

  const error = validarCiudad(parsed.data.ciudad)
  if (error) throw createError({ statusCode: 400, statusMessage: error })
  const ciudad = normalizarCiudad(parsed.data.ciudad)

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
    data: { ciudadEnvio: ciudad },
    include: ORDEN_INCLUDE,
  })

  const antes = orden.ciudadEnvio ? ` (antes ${orden.ciudadEnvio})` : ''
  await auditar(actor.id, 'UPDATE', 'inspeccion-muebles', orden.id, `${orden.codigo} va a ${ciudad}${antes} — ${inspector.nombre}`)

  return { success: true, data: mapOrdenMuebles(actualizada) }
})
