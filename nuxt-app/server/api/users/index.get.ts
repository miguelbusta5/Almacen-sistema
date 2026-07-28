import { defineEventHandler, getQuery, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { USER_PUBLIC_SELECT } from '../../utils/usuarios'

// GET /api/users — dos modos, igual que la ruta Next:
//   ?role=X  → lista acotada para dropdowns (supervisores y gerencia)
//   sin role → lista completa de gestión, solo ADMIN
// Sustituye al antiguo server/api/users.get.ts, que solo cubría el primer modo.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  const sp = getQuery(event)
  const roleFilter = sp.role ? String(sp.role) : ''

  if (roleFilter) {
    const allowed = ['ADMIN', 'GERENTE', 'SUPERVISOR_TRANSPORTE', 'SUPERVISOR_TIENDA', 'SUPERVISOR_INVENTARIO']
    if (!allowed.includes(actor.role)) {
      throw createError({ statusCode: 403, statusMessage: 'No autorizado' })
    }
    const users = await prisma.user.findMany({
      where: { role: roleFilter as never, active: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    })
    return { success: true, data: users }
  }

  if (actor.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'No autorizado' })
  }
  const users = await prisma.user.findMany({
    select: USER_PUBLIC_SELECT,
    orderBy: { createdAt: 'desc' },
  })
  return { success: true, data: users }
})
