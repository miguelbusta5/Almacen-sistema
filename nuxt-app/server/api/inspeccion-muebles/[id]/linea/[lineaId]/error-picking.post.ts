import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../../../utils/prisma'
import { auditar, ordenPorId, ORDEN_INCLUDE, requireInspeccion } from '../../../../../utils/muebles'
import { esTipoErrorPicking, TIPO_ERROR_PICKING_LABEL, type TipoErrorPicking } from '../../../../../utils/mueblesCalc'
import { mapOrdenMuebles } from '../../../../../utils/mapRow'

const schema = z.object({
  tipo: z.string().refine(esTipoErrorPicking, 'Elige el tipo de error'),
  nota: z.string().trim().max(500).nullable().optional(),
})

/**
 * POST /api/inspeccion-muebles/:id/linea/:lineaId/error-picking - SOLO ADMIN.
 *
 * Marca (o corrige, o con `quitar: true` quita) el error de picking de un PLU.
 * Queda a nombre del operario que pickeo ese PLU, sellado aqui: si despues se
 * corrige la linea, el error sigue diciendo quien lo hizo. Sale en Indicadores
 * Muebles.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireInspeccion(event)
  if (actor.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Solo el administrador marca errores de picking' })
  }
  const id = getRouterParam(event, 'id')!
  const lineaId = getRouterParam(event, 'lineaId')!

  const body = await readBody(event).catch(() => null)
  const quitar = body?.quitar === true

  const orden = await ordenPorId(id)
  if (orden.estado !== 'EN_INSPECCION') {
    throw createError({ statusCode: 409, statusMessage: 'Los errores se marcan en órdenes en inspección' })
  }
  const linea = orden.lineas.find((l) => l.id === lineaId)
  if (!linea) throw createError({ statusCode: 404, statusMessage: 'PLU no encontrado en esta orden' })

  const vigente = await prisma.errorPickingMuebles.findFirst({ where: { lineaId, deletedAt: null } })
  let detalle: string

  if (quitar) {
    if (!vigente) throw createError({ statusCode: 409, statusMessage: 'Ese PLU no tiene error marcado' })
    await prisma.errorPickingMuebles.update({ where: { id: vigente.id }, data: { deletedAt: new Date() } })
    detalle = `Error de picking quitado del PLU ${linea.plu} (${orden.codigo})`
  } else {
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
    }
    const tipo = parsed.data.tipo as TipoErrorPicking
    const nota = parsed.data.nota?.trim() || null
    if (vigente) {
      await prisma.errorPickingMuebles.update({ where: { id: vigente.id }, data: { tipo, nota, marcadoPorId: actor.id } })
    } else {
      await prisma.errorPickingMuebles.create({
        data: {
          ordenId: orden.id, lineaId, plu: linea.plu, operarioId: linea.operarioId,
          tipo, nota, marcadoPorId: actor.id,
        },
      })
    }
    detalle = `Error de picking en ${orden.codigo}, PLU ${linea.plu} (${linea.operario?.name ?? 'operario'}): `
      + `${TIPO_ERROR_PICKING_LABEL[tipo]}${nota ? ` — ${nota}` : ''}`
  }

  await auditar(actor.id, 'UPDATE', 'inspeccion-muebles', orden.id, detalle)
  const actualizada = await prisma.ordenMuebles.findUniqueOrThrow({ where: { id: orden.id }, include: ORDEN_INCLUDE })
  return { success: true, data: mapOrdenMuebles(actualizada) }
})
