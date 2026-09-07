import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { assertGestorMontacargas } from '../../utils/montacargas'

// GET /api/montacargas/operarios - para el filtro por montacarguista del listado.
// Sin filtrar por tipo a proposito: es el mismo equipo en los tres flujos.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertGestorMontacargas(actor.role)

  const rows = await prisma.movimientoMontacargas.findMany({
    where: { deletedAt: null },
    distinct: ['creadoPorId'],
    select: { creadoPorId: true, creadoPor: { select: { name: true } } },
  })

  const data = rows
    .map((r) => ({ id: r.creadoPorId, nombre: r.creadoPor?.name ?? 'Usuario' }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  return { success: true, data }
})
