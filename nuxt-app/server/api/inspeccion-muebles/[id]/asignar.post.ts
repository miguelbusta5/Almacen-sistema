import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { auditar, ordenPorId, ORDEN_INCLUDE, requireInspeccion } from '../../../utils/muebles'
import { mapOrdenMuebles } from '../../../utils/mapRow'

const schema = z.object({ inspectorId: z.string().min(1) })

/**
 * POST /api/inspeccion-muebles/:id/asignar - un inspector toma la orden.
 *
 * La orden se asigna a un INSPECTOR DEL CATALOGO, no al usuario logueado: el
 * area comparte un solo login entre ~5 personas porque solo hay 2 PCs, asi que
 * la trazabilidad del tiempo la da el catalogo, no la autenticacion.
 *
 * Reasignar esta permitido (una orden puede terminarla otra persona), pero deja
 * rastro en la bitacora.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireInspeccion(event)
  const id = getRouterParam(event, 'id')!

  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Elige tu nombre de la lista' })
  }

  const orden = await ordenPorId(id)
  if (orden.estado !== 'EN_INSPECCION') {
    throw createError({ statusCode: 409, statusMessage: 'Esa orden no esta en inspeccion' })
  }

  const inspector = await prisma.inspector.findFirst({
    where: { id: parsed.data.inspectorId, activo: true },
    select: { id: true, nombre: true },
  })
  if (!inspector) throw createError({ statusCode: 404, statusMessage: 'Inspector no encontrado' })

  const actualizada = await prisma.ordenMuebles.update({
    where: { id: orden.id },
    data: { inspectorId: inspector.id, actualizadoPorId: actor.id },
    include: ORDEN_INCLUDE,
  })

  const antes = orden.inspector ? ` (antes ${orden.inspector.nombre})` : ''
  await auditar(
    actor.id, 'UPDATE', 'inspeccion-muebles', orden.id,
    `Orden ${orden.codigo} asignada a ${inspector.nombre}${antes}`,
  )

  return { success: true, data: mapOrdenMuebles(actualizada) }
})
