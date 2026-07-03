import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'

// GET /api/transporte/sin-contacto — guardados activos sin ningún contacto.
export default defineEventHandler(async (event) => {
  await requireAuth(event)

  const conContacto = await prisma.contactoGuardado.findMany({
    select: { guardadoClientId: true }, distinct: ['guardadoClientId'],
  })
  const idsConContacto = new Set(conContacto.map((c: any) => c.guardadoClientId))

  const activos = await prisma.transporteGuardado.findMany({
    where: { estado: 'PENDIENTE DESPACHO' },
    select: { client_id: true, documento: true, fecha: true, ubicacion: true },
    orderBy: { fecha: 'asc' },
  })
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
