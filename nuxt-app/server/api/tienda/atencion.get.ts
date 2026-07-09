import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { mapDespacho } from '../../utils/mapRow'

const MAX_RESULTS = 50

// GET /api/tienda/atencion — despachos con novedad o rechazados, para el
// banner de atención. Antes se derivaba filtrando el listado completo
// (pageSize=500) cargado en la pantalla principal; ahora es un endpoint
// aparte, acotado, independiente de la paginación de la lista.
export default defineEventHandler(async (event) => {
  await requireAuth(event)

  const rows = await prisma.despachoTienda.findMany({
    where: { estado: { in: ['CON_NOVEDAD', 'RECHAZADO'] } },
    include: { creadoPor: { select: { id: true, name: true } }, plines: true, guardadoPendiente: { include: { asignadoA: { select: { name: true } } } } },
    orderBy: [{ fechaCreacion: 'desc' }, { createdAt: 'desc' }],
    take: MAX_RESULTS,
  })

  return { success: true, data: rows.map(mapDespacho) }
})
