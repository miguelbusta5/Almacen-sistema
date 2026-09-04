import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { assertGestorEstibas } from '../../utils/estibas'

// GET /api/estibas/operarios — para el filtro por montacarguista del listado.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertGestorEstibas(actor.role)

  const rows = await prisma.estiba.findMany({
    where: { deletedAt: null },
    distinct: ['creadoPorId'],
    select: { creadoPorId: true, creadoPor: { select: { name: true } } },
  })

  const data = rows
    .map((r) => ({ id: r.creadoPorId, nombre: r.creadoPor?.name ?? 'Usuario' }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  return { success: true, data }
})
