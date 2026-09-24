import { getRouterParam, readBody, createError } from 'h3'
import { defineOperacionAlmacenHandler } from '../../../utils/operacionAlmacen'
import { prisma } from '../../../utils/prisma'
import { requirePickingActivo, ordenPorId, esParticipante, ordenAbierta, equipoDelDia, auditar } from '../../../utils/muebles'
export default defineOperacionAlmacenHandler(async event => {
  const actor = await requirePickingActivo(event), orden = await ordenPorId(getRouterParam(event,'id')!), b = await readBody(event)
  if (!esParticipante(orden,actor.id) || orden.estado !== 'EN_PICKING') throw createError({statusCode:403,statusMessage:'Solo puedes reasignar tu orden en picking'})
  if (orden.pausaInicio || orden.lineas.some(l => l.estado === 'EN_PICKING' && l.operarioId === actor.id)) throw createError({statusCode:409,statusMessage:'Termina tu PLU abierto y reanuda la orden antes de reasignar'})
  if (!b || typeof b.operarioId !== 'string' || b.operarioId === actor.id) throw createError({statusCode:400,statusMessage:'Selecciona otro operario'})
  const otro = await prisma.user.findFirst({where:{id:b.operarioId,role:'PICKING_MUEBLES',active:true}})
  if (!otro) throw createError({statusCode:400,statusMessage:'Operario no disponible'})
  const abierta = await ordenAbierta(otro.id)
  const equipo = await equipoDelDia(otro.id)
  if (!equipo) throw createError({statusCode:409,statusMessage:'El operario debe tener equipo asignado hoy'})
  const now = new Date()
  const previo = orden.participantes.find(p => p.usuarioId === otro.id)

  // Si el otro ya tiene una orden abierta (24-09): antes se bloqueaba. Ahora la
  // orden queda TRANSFERIDA a su nombre, pendiente de picking: el que la pasa
  // sale y queda libre, y el otro la toma cuando pase la suya a inspeccion
  // (entra por /unirse). El reloj de la orden no cuenta esa espera.
  if (abierta && abierta.id !== orden.id) {
    await prisma.$transaction(async tx => {
      await tx.participanteOrdenMuebles.update({ where: { ordenId_usuarioId: { ordenId: orden.id, usuarioId: actor.id } }, data: { salioAt: now } })
      await tx.ordenMuebles.update({ where: { id: orden.id }, data: { transferidaAId: otro.id, transferidaAt: now } })
      await tx.notificacion.create({ data: { userId: otro.id, titulo: 'Orden de muebles transferida: pendiente de picking', descripcion: `${orden.codigo} · tómala al pasar ${abierta.codigo} a inspección`, tipo: 'ASIGNACION', enlace: '/dashboard/picking-muebles' } })
    })
    await auditar(actor.id, 'UPDATE', 'picking-muebles', orden.id, `Orden ${orden.codigo} transferida a ${otro.name} (tenia abierta ${abierta.codigo}): pendiente de picking; ${actor.name} queda libre.`)
    return { success: true, transferida: true, operario: otro.name }
  }

  // Todo junto o nada: entre sacar al saliente y meter al entrante la orden
  // queda SIN participante activo, y esParticipante() filtra por salioAt, asi
  // que nadie podria cerrarla ni tocarla. Mismo criterio que la reasignacion de
  // montaje-resurtido.
  await prisma.$transaction(async tx => {
    // El equipo con el que el entrante trabajo antes se sella en sus lineas: si
    // hoy entra con otro, lo ya hecho no cambia de equipo.
    if (previo?.equipo) await tx.lineaMuebles.updateMany({ where: { ordenId: orden.id, operarioId: otro.id, tipoEquipo: null }, data: { tipoEquipo: previo.equipo.tipo } })
    await tx.participanteOrdenMuebles.update({ where: { ordenId_usuarioId: { ordenId: orden.id, usuarioId: actor.id } }, data: { salioAt: now } })
    await tx.participanteOrdenMuebles.upsert({
      where: { ordenId_usuarioId: { ordenId: orden.id, usuarioId: otro.id } },
      create: { ordenId: orden.id, usuarioId: otro.id, equipoId: equipo.id, seUnioAt: now },
      update: { salioAt: null, seUnioAt: now, equipoId: equipo.id },
    })
    if (orden.transferidaAId) await tx.ordenMuebles.update({ where: { id: orden.id }, data: { transferidaAId: null, transferidaAt: null } })
    await tx.notificacion.create({ data: { userId: otro.id, titulo: 'Orden de muebles reasignada', descripcion: orden.codigo, tipo: 'ASIGNACION', enlace: '/dashboard/picking-muebles' } })
  })

  // La bitacora va despues del commit: no puede tumbar el trabajo del operario.
  await auditar(actor.id, 'UPDATE', 'picking-muebles', orden.id, `Orden ${orden.codigo} reasignada a ${otro.name}; ${actor.name} queda libre. Los PLU previos conservan su operario.`)
  return {success:true}
})
