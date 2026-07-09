import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'

// GET /api/transporte/sin-contacto — guardados activos sin ningún contacto.
export default defineEventHandler(async (event) => {
  await requireAuth(event)

  // Antes se traía TODO el histórico de contactoGuardado (crece para
  // siempre) para armar el Set — ahora se acota primero a los guardados
  // activos (pequeño, por estado) y solo se consulta el contacto de esos.
  const activos = await prisma.transporteGuardado.findMany({
    where: { estado: 'PENDIENTE DESPACHO' },
    select: { client_id: true, documento: true, fecha: true, ubicacion: true },
    orderBy: { fecha: 'asc' },
  })

  const idsConContacto = activos.length
    ? new Set(
        (await prisma.contactoGuardado.findMany({
          where: { guardadoClientId: { in: activos.map((g: any) => g.client_id) } },
          select: { guardadoClientId: true },
          distinct: ['guardadoClientId'],
        })).map((c: any) => c.guardadoClientId),
      )
    : new Set<string>()
  const sinContacto = activos.filter((g: any) => !idsConContacto.has(g.client_id))

  return {
    success: true,
    count: sinContacto.length,
    items: sinContacto.slice(0, 20).map((g: any) => ({
      clientId: g.client_id, documento: g.documento,
      fecha: g.fecha instanceof Date ? g.fecha.toISOString().slice(0, 10) : String(g.fecha),
    })),
  }
})
