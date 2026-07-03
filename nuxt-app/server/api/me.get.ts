import { defineEventHandler } from 'h3'
import { getSessionUser } from '../utils/auth'
import { can } from '../utils/permissions'

// Devuelve la sesión actual (o authenticated:false). La UI usa el rol para
// ocultar acciones; el servidor siempre revalida con requireCan.
export default defineEventHandler(async (event) => {
  const user = await getSessionUser(event)
  if (!user) return { authenticated: false }
  return {
    authenticated: true,
    user: {
      id: user.id, name: user.name, email: user.email, role: user.role,
      can: {
        create: can(user.role, 'create'),
        edit: can(user.role, 'edit'),
        delete: can(user.role, 'delete'),
      },
    },
  }
})
