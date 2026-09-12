import { defineEventHandler } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireRole } from '../../../utils/auth'
import { ROLES_GESTION_MUEBLES } from '../../../utils/mueblesCalc'
import { mapEquipoMuebles } from '../../../utils/mapRow'

/** GET /api/muebles-admin/equipos - catalogo de Order Pickers y Genies. */
export default defineEventHandler(async (event) => {
  await requireRole(event, ROLES_GESTION_MUEBLES)
  const equipos = await prisma.equipoMuebles.findMany({ orderBy: [{ tipo: 'asc' }, { codigo: 'asc' }] })
  return { success: true, data: equipos.map(mapEquipoMuebles) }
})
