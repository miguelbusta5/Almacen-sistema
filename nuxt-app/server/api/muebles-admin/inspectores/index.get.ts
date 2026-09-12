import { defineEventHandler } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireRole } from '../../../utils/auth'
import { ROLES_GESTION_MUEBLES } from '../../../utils/mueblesCalc'

/** GET /api/muebles-admin/inspectores - catalogo completo (activos e inactivos). */
export default defineEventHandler(async (event) => {
  await requireRole(event, ROLES_GESTION_MUEBLES)
  const inspectores = await prisma.inspector.findMany({
    select: { id: true, nombre: true, activo: true },
    orderBy: { nombre: 'asc' },
  })
  return { success: true, data: inspectores }
})
