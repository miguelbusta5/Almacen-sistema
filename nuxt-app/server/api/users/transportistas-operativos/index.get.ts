import { defineEventHandler } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireRole } from '../../../utils/auth'

const TRANSPORTISTA_SELECT = {
  id: true, nombre: true, telefono: true, activo: true,
  user: { select: { id: true, name: true, email: true, active: true } },
  vehiculo: { select: { id: true, placa: true, tipo: true, estado: true } },
} as const

// GET /api/users/transportistas-operativos — conductores con su vehículo y su
// cuenta vinculada (si la tienen). Solo ADMIN.
export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])
  const transportistas = await prisma.transportista.findMany({
    select: TRANSPORTISTA_SELECT,
    orderBy: { nombre: 'asc' },
  })
  return { success: true, data: transportistas }
})
