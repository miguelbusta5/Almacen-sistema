import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { assertUsuarioMontacargas } from '../../utils/montacargas'

/**
 * GET /api/montacargas/mis-pendientes
 *
 * Cuántos PLUs tiene el actor en la mano, por tipo. Sirve para llevarlo a donde
 * está su trabajo: un ayudante que recibe un movimiento de depósito abría el
 * módulo en la pestaña de Recepción y no veía nada, porque el traspaso no le
 * decía dónde mirar. Con esto la UI selecciona la pestaña correcta y avisa
 * cuando lo pendiente está en el otro módulo (Resurtido vive aparte).
 *
 * Sin filtro de tipo a propósito: la gracia es justamente ver los tres a la vez.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioMontacargas(actor.role)

  const filas = await prisma.movimientoMontacargas.groupBy({
    by: ['tipo'],
    where: {
      responsableId: actor.id,
      estado: { in: ['EN_CURSO', 'NOVEDAD'] },
      deletedAt: null,
    },
    _count: { _all: true },
  })

  const data = { RECEPCION: 0, MOVIMIENTO: 0, RESURTIDO: 0 }
  for (const f of filas) data[f.tipo] = f._count._all

  return { success: true, data }
})
