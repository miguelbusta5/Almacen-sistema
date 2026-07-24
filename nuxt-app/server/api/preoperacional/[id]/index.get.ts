import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireRole } from '../../../utils/auth'

// GET /api/preoperacional/[id] — detalle completo (vista supervisor).
export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN', 'GERENTE', 'SUPERVISOR_TRANSPORTE'])
  const id = getRouterParam(event, 'id')!

  const inspeccion = await prisma.inspeccionPreoperacional.findUnique({
    where: { id },
    include: {
      conductor: { select: { id: true, nombre: true, telefono: true } },
      vehiculo: { select: { id: true, placa: true, tipo: true } },
      realizadoPor: { select: { id: true, name: true } },
      items: { orderBy: [{ categoria: 'asc' }, { item: 'asc' }] },
    },
  })
  if (!inspeccion) throw createError({ statusCode: 404, statusMessage: 'No encontrada' })

  return {
    success: true,
    data: {
      id: inspeccion.id,
      fecha: inspeccion.fecha instanceof Date ? inspeccion.fecha.toISOString().slice(0, 10) : inspeccion.fecha,
      kilometraje: inspeccion.kilometraje ?? null,
      observaciones: inspeccion.observaciones ?? null,
      estado: inspeccion.estado,
      conductor: inspeccion.conductor,
      vehiculo: inspeccion.vehiculo,
      realizadoPor: inspeccion.realizadoPor,
      items: inspeccion.items.map((i) => ({
        id: i.id,
        categoria: i.categoria,
        item: i.item,
        resultado: i.resultado,
        esCritico: i.esCritico,
        fotoUrl: i.fotoUrl ?? null,
        observacion: i.observacion ?? null,
      })),
    },
  }
})
