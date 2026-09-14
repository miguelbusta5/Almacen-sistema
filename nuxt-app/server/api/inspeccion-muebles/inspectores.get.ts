import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireInspeccion } from '../../utils/muebles'

/** GET /api/inspeccion-muebles/inspectores - catalogo para el desplegable. */
export default defineEventHandler(async (event) => {
  await requireInspeccion(event)
  const inspectores = await prisma.inspector.findMany({
    where: { activo: true },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  })
  return { success: true, data: inspectores }
})
