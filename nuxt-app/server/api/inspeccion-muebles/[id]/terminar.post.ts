import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import { auditar, ordenPorId, ORDEN_INCLUDE, requireInspeccion } from '../../../utils/muebles'
import { validarTerminarConErrores } from '../../../utils/mueblesCalc'
import { mapOrdenMuebles } from '../../../utils/mapRow'

/**
 * POST /api/inspeccion-muebles/:id/terminar - SOLO ADMIN.
 *
 * Termina una orden con errores de picking para que el patinador la entregue.
 * Los PLU con error pueden quedar sin revisar; los demas tienen que estar
 * inspeccionados (validarTerminarConErrores). Un PLU con error que estaba en
 * revision cierra su reloj a esta hora: cuenta el tiempo que de verdad llevaba.
 * Los que nunca se empezaron quedan listos sin tiempo de inspeccion.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireInspeccion(event)
  if (actor.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Solo el administrador termina órdenes con errores' })
  }
  const orden = await ordenPorId(getRouterParam(event, 'id')!)
  if (orden.estado !== 'EN_INSPECCION') {
    throw createError({ statusCode: 409, statusMessage: 'Esa orden no está en inspección' })
  }
  if (orden.inspPausaInicio) {
    throw createError({ statusCode: 409, statusMessage: 'La orden está en almuerzo: termina el almuerzo primero' })
  }

  const errores = await prisma.errorPickingMuebles.findMany({
    where: { ordenId: orden.id, deletedAt: null },
    select: { lineaId: true },
  })
  const conError = new Set(errores.map((e) => e.lineaId))
  const error = validarTerminarConErrores(
    orden.lineas.map((l) => ({ plu: l.plu, estado: l.estado, tieneError: conError.has(l.id) })),
  )
  if (error) throw createError({ statusCode: 409, statusMessage: error })

  const now = new Date()
  const actualizada = await prisma.$transaction(async (tx) => {
    for (const l of orden.lineas) {
      if (!conError.has(l.id) || l.estado === 'LISTO') continue
      await tx.lineaMuebles.update({
        where: { id: l.id },
        data: {
          estado: 'LISTO',
          // En revision: se cierra su reloj. Sin empezar: queda sin tiempo.
          ...(l.inspHoraInicio && !l.inspHoraFin ? { inspHoraFin: now } : {}),
          // Taller o repuesto abiertos: se cierran para que no queden corriendo.
          ...(l.ebanisteriaInicio && !l.ebanisteriaFin ? { ebanisteriaFin: now } : {}),
          ...(l.reposicionInicio && !l.reposicionFin ? { reposicionFin: now } : {}),
        },
      })
    }
    return tx.ordenMuebles.update({
      where: { id: orden.id },
      data: { estado: 'INSPECCIONADA', horaFinInspeccion: now, actualizadoPorId: actor.id },
      include: ORDEN_INCLUDE,
    })
  })

  await auditar(
    actor.id, 'UPDATE', 'inspeccion-muebles', orden.id,
    `Orden ${orden.codigo} terminada con ${conError.size} ${conError.size === 1 ? 'error' : 'errores'} de picking: lista para entregar a transporte`,
  )

  return { success: true, data: mapOrdenMuebles(actualizada) }
})
