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
  if (abierta && abierta.id !== orden.id) throw createError({statusCode:409,statusMessage:'El operario ya tiene otra orden abierta'})
  const equipo = await equipoDelDia(otro.id)
  if (!equipo) throw createError({statusCode:409,statusMessage:'El operario debe tener equipo asignado hoy'})
  const now = new Date()
  const previo = orden.participantes.find(p => p.usuarioId === otro.id)
  if (previo?.equipo) await prisma.lineaMuebles.updateMany({ where: { ordenId: orden.id, operarioId: otro.id, tipoEquipo: null }, data: { tipoEquipo: previo.equipo.tipo } })
  await prisma.participanteOrdenMuebles.update({where:{ordenId_usuarioId:{ordenId:orden.id,usuarioId:actor.id}},data:{salioAt:now}})
  await prisma.participanteOrdenMuebles.upsert({where:{ordenId_usuarioId:{ordenId:orden.id,usuarioId:otro.id}},create:{ordenId:orden.id,usuarioId:otro.id,equipoId:equipo.id,seUnioAt:now},update:{salioAt:null,seUnioAt:now,equipoId:equipo.id}})
  await auditar(actor.id,'UPDATE','picking-muebles',orden.id,`Orden ${orden.codigo} reasignada a ${otro.name}; ${actor.name} queda libre. Los PLU previos conservan su operario.`)
  await prisma.notificacion.create({data:{userId:otro.id,titulo:'Orden de muebles reasignada',descripcion:orden.codigo,tipo:'ASIGNACION',enlace:'/dashboard/picking-muebles'}})
  return {success:true}
})
