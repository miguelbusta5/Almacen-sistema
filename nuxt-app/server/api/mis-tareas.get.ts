import { defineEventHandler, createError } from 'h3'
import { prisma } from '../utils/prisma'
import { requireAuth } from '../utils/auth'

export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  const role = actor.role
  const userName = actor.name
  const userId = actor.id

  const notifNoLeidas = await prisma.notificacion.count({ where: { userId, leida: false } })

  const novedades = (role === 'INVENTARIO' || role === 'SUPERVISOR_INVENTARIO' || role === 'GERENTE' || role === 'ADMIN' || role === 'OPERADOR')
    ? await prisma.novedad.findMany({
        where: {
          estado: { not: 'SOLUCIONADO' },
          ...(role === 'INVENTARIO' ? { asignadoA: userName } : {}),
        },
        select: { id: true, plu: true, posicion: true, estado: true, fabricante: true, asignadoA: true, fechaCompromiso: true },
        orderBy: { created_at: 'asc' as const },
        take: 50,
      })
    : []

  const guardados = (role === 'TRANSPORTE' || role === 'SUPERVISOR_TRANSPORTE' || role === 'GERENTE' || role === 'ADMIN' || role === 'OPERADOR')
    ? await prisma.transporteGuardado.findMany({
        where: { estado: 'PENDIENTE DESPACHO' },
        select: { id: true, client_id: true, documento: true, ubicacion: true, estado: true, fecha: true, nota: true, tipo: true },
        orderBy: { fecha: 'asc' as const },
        take: 50,
      })
    : []

  const guardadosTiendaPendientes = (role === 'TRANSPORTE' || role === 'SUPERVISOR_TRANSPORTE' || role === 'GERENTE' || role === 'ADMIN')
    ? await prisma.guardadoPendienteTienda.findMany({
        where: {
          estado: 'PENDIENTE',
          ...(role === 'TRANSPORTE' ? { asignadoAId: userId } : {}),
        },
        include: {
          despacho: { select: { id: true, centroCostos: true, numeroDocumento: true, clienteNombre: true, numeroCajas: true } },
        },
        orderBy: { createdAt: 'asc' as const },
        take: 50,
      })
    : []

  const despachosTienda = (role === 'TIENDA' || role === 'SUPERVISOR_TIENDA' || role === 'SUPERVISOR_TRANSPORTE' || role === 'GERENTE' || role === 'ADMIN')
    ? await prisma.despachoTienda.findMany({
        where: { estado: { in: ['CREADO_TIENDA', 'RECOGIDO_TIENDA', 'ENTREGADO_CEDI', 'CON_NOVEDAD'] } },
        select: { id: true, centroCostos: true, numeroDocumento: true, clienteNombre: true, estado: true, fechaCreacion: true, fechaEntregaComprometida: true, createdAt: true },
        orderBy: { createdAt: 'asc' as const },
        take: 50,
      })
    : []

  return {
    success: true,
    role,
    data: {
      notifNoLeidas,
      novedades: novedades.map((n) => ({
        id: n.id, plu: n.plu, posicion: n.posicion, estado: n.estado,
        fabricante: n.fabricante, asignadoA: n.asignadoA,
        fechaCompromiso: n.fechaCompromiso ? new Date(n.fechaCompromiso).toISOString().slice(0, 10) : null,
        esPropio: n.asignadoA === userName,
      })),
      guardados: guardados.map((g) => ({
        id: g.id, clientId: g.client_id, documento: g.documento,
        ubicacion: g.ubicacion, estado: g.estado,
        fecha: new Date(g.fecha).toISOString().slice(0, 10), nota: g.nota, tipo: g.tipo,
      })),
      guardadosTiendaPendientes: guardadosTiendaPendientes.map((p) => ({
        id: p.id, despachoId: p.despachoId, nota: p.nota,
        createdAt: p.createdAt.toISOString(),
        documento: p.despacho.numeroDocumento, clienteNombre: p.despacho.clienteNombre,
        centroCostos: p.despacho.centroCostos, numeroCajas: p.despacho.numeroCajas,
      })),
      despachosTienda: despachosTienda.map((d) => ({
        id: d.id, centroCostos: d.centroCostos, numeroDocumento: d.numeroDocumento,
        clienteNombre: d.clienteNombre, estado: d.estado,
        fechaCreacion: new Date(d.fechaCreacion).toISOString().slice(0, 10),
        fechaEntregaComprometida: d.fechaEntregaComprometida ? new Date(d.fechaEntregaComprometida).toISOString().slice(0, 10) : null,
        createdAt: d.createdAt.toISOString(),
      })),
    },
  }
})
