import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { mapInspeccion } from '../../utils/mapRow'
import { CHECKLIST_PREOPERACIONAL, todayISO } from '../../utils/preoperacional'

async function getTransportista(userId: string) {
  return prisma.transportista.findFirst({ where: { userId, activo: true }, include: { vehiculo: true } })
}

// GET /api/preoperacional — vista del conductor (rol TRANSPORTISTA).
export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, ['TRANSPORTISTA'])

  const transportista = await getTransportista(actor.id)
  if (!transportista) {
    return {
      success: true,
      checklist: CHECKLIST_PREOPERACIONAL,
      transportista: null,
      vehiculo: null,
      inspeccionHoy: null,
      historial: [],
    }
  }

  const [inspeccionHoy, historial] = await Promise.all([
    prisma.inspeccionPreoperacional.findFirst({
      where: { conductorId: transportista.id, fecha: new Date(todayISO()), vigente: true },
      include: { vehiculo: true, conductor: true, items: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.inspeccionPreoperacional.findMany({
      where: { conductorId: transportista.id },
      include: { vehiculo: true, conductor: true, items: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ])

  return {
    success: true,
    checklist: CHECKLIST_PREOPERACIONAL,
    transportista: {
      id: transportista.id,
      nombre: transportista.nombre,
      telefono: transportista.telefono ?? null,
    },
    vehiculo: transportista.vehiculo
      ? {
          id: transportista.vehiculo.id,
          placa: transportista.vehiculo.placa,
          tipo: transportista.vehiculo.tipo,
          estado: transportista.vehiculo.estado,
        }
      : null,
    inspeccionHoy: inspeccionHoy ? mapInspeccion(inspeccionHoy) : null,
    historial: historial.map(mapInspeccion),
  }
})
