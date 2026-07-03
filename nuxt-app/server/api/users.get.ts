import { defineEventHandler, getQuery, createError } from 'h3'
import { prisma } from '../utils/prisma'
import { requireAuth } from '../utils/auth'

// GET /api/users?role=X — solo el filtro por rol (usado en dropdowns, p. ej.
// asignar guardado a un operario TRANSPORTE). La lista completa de usuarios
// (gestión, solo ADMIN) sigue viviendo únicamente en la app Next.js.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  const sp = getQuery(event)
  const roleFilter = String(sp.role ?? '')
  if (!roleFilter) throw createError({ statusCode: 400, statusMessage: 'role requerido' })

  const allowed = ['ADMIN', 'GERENTE', 'SUPERVISOR_TRANSPORTE', 'SUPERVISOR_TIENDA', 'SUPERVISOR_INVENTARIO']
  if (!allowed.includes(actor.role)) {
    throw createError({ statusCode: 403, statusMessage: 'No autorizado' })
  }

  const users = await prisma.user.findMany({
    where: { role: roleFilter as any, active: true },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' },
  })
  return { success: true, data: users }
})
