import { defineOperacionAlmacenHandler } from '../../../utils/operacionAlmacen'
import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import {
  auditar, equipoDelDia, esParticipante, ordenAbierta, ordenPorId, ORDEN_INCLUDE, requirePickingActivo,
} from '../../../utils/muebles'
import { mapOrdenMuebles } from '../../../utils/mapRow'

/**
 * POST /api/picking-muebles/:id/unirse - el segundo operario entra a la orden.
 *
 * El caso: por el tipo de mercancia el Genie no puede bajar un PLU y se le
 * reasigna al del Order Picker. Este intenta crear la orden, la app le dice que
 * ya existe, confirma que trae PLUs reasignados y entra AQUI — a la misma orden,
 * no a una paralela que despues nadie sabria juntar.
 *
 * La reasignacion en si es verbal (asi trabaja el area hoy); lo que la app
 * registra es quien acabo bajando cada PLU, que es el dato que hacia falta.
 *
 * No arranca ningun reloj: el de la orden ya corre desde que la abrio el primero.
 */
export default defineOperacionAlmacenHandler(async (event) => {
  const actor = await requirePickingActivo(event)
  const id = getRouterParam(event, 'id')!

  const orden = await ordenPorId(id)
  if (orden.estado !== 'EN_PICKING') {
    throw createError({ statusCode: 409, statusMessage: 'Esa orden ya paso a inspeccion' })
  }
  if (esParticipante(orden, actor.id)) {
    // Ya esta dentro: devolver la orden es mas util que un error.
    return { success: true, data: mapOrdenMuebles(orden) }
  }

  // Unirse ocupa tu turno igual que abrir una propia, asi que no puedes tener las dos.
  const abierta = await ordenAbierta(actor.id)
  if (abierta) {
    throw createError({
      statusCode: 409,
      statusMessage: `Ya tienes la orden ${abierta.codigo} abierta: pasala a inspeccion antes de unirte a otra`,
    })
  }

  const equipo = await equipoDelDia(actor.id)
  if (!equipo) {
    throw createError({
      statusCode: 409,
      statusMessage: 'No tienes equipo asignado hoy: pide al administrador que te asigne el Order Picker o el Genie',
    })
  }

  const actualizada = await prisma.$transaction(async (tx) => {
    const previo = orden.participantes.find(p => p.usuarioId === actor.id)
    if (previo?.equipo) await tx.lineaMuebles.updateMany({ where: { ordenId: orden.id, operarioId: actor.id, tipoEquipo: null }, data: { tipoEquipo: previo.equipo.tipo } })
    await tx.participanteOrdenMuebles.upsert({
      where: { ordenId_usuarioId: { ordenId: orden.id, usuarioId: actor.id } },
      create: { ordenId: orden.id, usuarioId: actor.id, equipoId: equipo.id, esCreador: false },
      update: { salioAt: null, seUnioAt: new Date(), equipoId: equipo.id },
    })
    return tx.ordenMuebles.findUniqueOrThrow({ where: { id: orden.id }, include: ORDEN_INCLUDE })
  })

  await auditar(
    actor.id, 'UPDATE', 'picking-muebles', orden.id,
    `Se unio a ${orden.codigo} con ${equipo.codigo} por PLU reasignados (la abrio ${orden.operario?.name ?? '?'})`,
  )

  return { success: true, data: mapOrdenMuebles(actualizada) }
})
