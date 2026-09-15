import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { assertPuedeMandarTarea } from '../../utils/tareasGenerales'
import { ROLES_ASIGNABLES } from '../../utils/tareasGeneralesCalc'

/** GET /api/tareas-generales/operarios - a quien se le puede mandar una tarea. */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertPuedeMandarTarea(actor.role)

  const usuarios = await prisma.user.findMany({
    where: { active: true, role: { in: [...ROLES_ASIGNABLES] } },
    select: { id: true, name: true, role: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  })
  return { success: true, data: usuarios.map((u) => ({ id: u.id, nombre: u.name, rol: u.role })) }
})
