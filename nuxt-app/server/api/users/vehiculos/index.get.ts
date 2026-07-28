import { defineEventHandler } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireRole } from '../../../utils/auth'

// GET /api/users/vehiculos — flota. Solo ADMIN.
export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])
  const vehiculos = await prisma.vehiculo.findMany({
    select: {
      id: true, placa: true, tipo: true, capacidadKg: true, estado: true,
      transportistas: { select: { id: true, nombre: true, activo: true } },
    },
    orderBy: { placa: 'asc' },
  })
  return { success: true, data: vehiculos }
})
