import { defineEventHandler, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { canViewPendientes } from '../../utils/permissions'

function mapPendiente(p: any) {
  const d = p.despacho
  return {
    id: p.id, despachoId: p.despachoId, estado: p.estado, nota: p.nota,
    guardadoClientId: p.guardadoClientId ?? null,
    createdAt: p.createdAt.toISOString(),
    completadoAt: p.completadoAt ? p.completadoAt.toISOString() : null,
    asignadoAId: p.asignadoAId,
    asignadoANombre: p.asignadoA?.name ?? null,
    despacho: {
      id: d.id, centroCostos: d.centroCostos, numeroDocumento: d.numeroDocumento,
      consecutivo: d.consecutivo, clienteNombre: d.clienteNombre,
      clienteDocumento: d.clienteDocumento ?? null, clienteTelefono: d.clienteTelefono ?? null,
      numeroCajas: d.numeroCajas ?? null, notaEntrega: d.notaEntrega ?? null,
      fechaEntregaComprometida: d.fechaEntregaComprometida ? d.fechaEntregaComprometida.toISOString().slice(0, 10) : null,
      entregadoCediAt: d.entregadoCediAt ? d.entregadoCediAt.toISOString() : null,
    },
  }
}

export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  if (!canViewPendientes(actor.role)) throw createError({ statusCode: 403, statusMessage: 'Sin permiso' })

  const pendientes = await prisma.guardadoPendienteTienda.findMany({
    where: { estado: 'PENDIENTE', ...(actor.role === 'TRANSPORTE' ? { asignadoAId: actor.id } : {}) },
    include: { asignadoA: { select: { id: true, name: true } }, despacho: true },
    orderBy: { createdAt: 'asc' },
  })

  return { success: true, data: pendientes.map(mapPendiente) }
})
