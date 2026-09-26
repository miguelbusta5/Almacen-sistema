import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { canSeeModule, type ModuleKey } from '../../utils/modulePermissions'
import { alertasAbiertas, LIMITES_ABIERTO_MIN, type RegistroAbierto } from '../../utils/alertasAbiertasCalc'

/**
 * GET /api/alertas/abiertas - lo que lleva abierto mas de su limite.
 *
 * En vivo y sin guardar nada: lo pide la barra superior cada minuto (con
 * alguien usando la pantalla) y en cuanto el registro se cierra deja de salir.
 * Solo se traen de la base los que ya pasaron su limite.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  const ahora = new Date()
  const antes = (min: number) => new Date(ahora.getTime() - min * 60_000)
  const L = LIMITES_ABIERTO_MIN

  const [recepciones, movimientos, picking, inspeccion, camiones] = await Promise.all([
    prisma.recepcionContenedor.findMany({
      where: { deletedAt: null, estado: 'EN_CURSO', horaInicio: { lte: antes(L.recepcion) } },
      select: { id: true, numeroPedido: true, proveedor: true, horaInicio: true, creadoPorId: true },
    }),
    prisma.movimientoMontacargas.findMany({
      where: { deletedAt: null, estado: 'EN_CURSO', horaInicio: { lte: antes(L.montacargas) } },
      select: { id: true, tipo: true, plu: true, horaInicio: true, responsableId: true, responsable: { select: { name: true } } },
    }),
    prisma.ordenMuebles.findMany({
      // Las transferidas esperan a que su operario las tome: no estan en curso.
      where: { deletedAt: null, estado: 'EN_PICKING', transferidaAId: null, horaInicio: { lte: antes(L.picking) } },
      select: { id: true, codigo: true, horaInicio: true, operarioId: true, operario: { select: { name: true } } },
    }),
    prisma.ordenMuebles.findMany({
      where: { deletedAt: null, estado: 'EN_INSPECCION', horaPasoInspeccion: { lte: antes(L.inspeccion) } },
      select: { id: true, codigo: true, horaPasoInspeccion: true, inspector: { select: { nombre: true } } },
    }),
    prisma.cargueCamion.findMany({
      where: { deletedAt: null, estado: 'EN_CURSO', horaInicio: { lte: antes(L.camion) } },
      select: { id: true, tipoVehiculo: true, transportadora: true, placa: true, horaInicio: true, creadoPorId: true },
    }),
  ])

  const registros: RegistroAbierto[] = [
    ...recepciones.map((r) => ({
      tipo: 'recepcion' as const, id: r.id, titulo: `Pedido ${r.numeroPedido}`, detalle: r.proveedor,
      desde: r.horaInicio, duenoId: r.creadoPorId, modulo: 'recepcion-contenedores', enlace: '/dashboard/recepcion-contenedores',
    })),
    ...movimientos.map((m) => {
      const recepcion = m.tipo === 'RECEPCION'
      return {
        tipo: 'montacargas' as const, id: m.id, titulo: `PLU ${m.plu}`, detalle: m.responsable?.name ?? null,
        desde: m.horaInicio, duenoId: m.responsableId,
        modulo: recepcion ? 'control-montacargas' : 'resurtido',
        enlace: recepcion ? '/dashboard/control-montacargas' : '/dashboard/resurtido',
      }
    }),
    ...picking.map((o) => ({
      tipo: 'picking' as const, id: o.id, titulo: o.codigo, detalle: o.operario?.name ?? null,
      desde: o.horaInicio, duenoId: o.operarioId, modulo: 'picking-muebles', enlace: '/dashboard/picking-muebles',
    })),
    ...inspeccion.map((o) => ({
      tipo: 'inspeccion' as const, id: o.id, titulo: o.codigo, detalle: o.inspector?.nombre ?? 'Sin inspector',
      desde: o.horaPasoInspeccion!, duenoId: null, modulo: 'inspeccion-muebles', enlace: '/dashboard/inspeccion-muebles',
    })),
    ...camiones.map((c) => ({
      tipo: 'camion' as const, id: c.id, titulo: c.placa ? `${c.tipoVehiculo} · ${c.placa}` : c.tipoVehiculo, detalle: c.transportadora,
      desde: c.horaInicio, duenoId: c.creadoPorId, modulo: 'cargue-camiones', enlace: '/dashboard/cargue-camiones',
    })),
  ]

  return {
    success: true,
    data: alertasAbiertas(registros, ahora, actor, (m) => canSeeModule(actor.role, m as ModuleKey)),
  }
})
