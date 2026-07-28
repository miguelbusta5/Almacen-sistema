import { defineEventHandler } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireRole } from '../../../utils/auth'

// GET /api/users/transportistas-disponibles — conductores activos, con vehículo y
// SIN cuenta vinculada: son los únicos a los que se puede enganchar un usuario nuevo
// con rol TRANSPORTISTA. Solo ADMIN.
export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])
  const transportistas = await prisma.transportista.findMany({
    where: { activo: true, userId: null, vehiculoId: { not: null } },
    select: {
      id: true, nombre: true, telefono: true,
      vehiculo: { select: { placa: true, tipo: true, estado: true } },
    },
    orderBy: { nombre: 'asc' },
  })
  return { success: true, data: transportistas }
})
