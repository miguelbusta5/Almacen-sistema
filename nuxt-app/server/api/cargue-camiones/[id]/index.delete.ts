import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import { auditarCargue, camionPorId, requireGestionCargue } from '../../../utils/cargueCamion'

/**
 * DELETE /api/cargue-camiones/:id - borra (suave) un camion registrado por
 * error. Solo supervision y con motivo. No devuelve los estados de Gourmet ni
 * de Muebles: si las ordenes si salieron, eso no se deshace aqui.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireGestionCargue(event, 'Solo supervision de transporte borra un camion')
  const camion = await camionPorId(getRouterParam(event, 'id')!)
  const body = await readBody(event).catch(() => null) as { motivo?: string } | null
  const motivo = String(body?.motivo ?? '').trim()
  if (motivo.length < 5) throw createError({ statusCode: 400, statusMessage: 'Escribe el motivo (minimo 5 caracteres)' })
  await prisma.cargueCamion.update({ where: { id: camion.id }, data: { deletedAt: new Date(), motivoCorreccion: motivo } })
  await auditarCargue(actor.id, 'DELETE', camion.id, `Camion ${camion.placa ?? camion.transportadora} borrado. Motivo: ${motivo}`)
  return { success: true }
})
