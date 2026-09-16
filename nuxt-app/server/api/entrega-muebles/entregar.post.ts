import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { auditar } from '../../utils/muebles'
import { puedeEntregarTransporte } from '../../utils/mueblesCalc'

const schema = z.object({ ordenIds: z.array(z.string().min(1)).min(1).max(100) })

/**
 * POST /api/entrega-muebles/entregar - CIERRA LA MEDICION de la orden.
 *
 * El patinador entrega varias de una vez (por eso es una lista): sube al camion
 * todo lo de una ciudad y lo marca junto. Aqui termina el lead time, que se mide
 * desde que se abrio el picking.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  if (!puedeEntregarTransporte(actor.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Sin acceso a la entrega a transporte' })
  }

  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Elige al menos una orden' })

  const now = new Date()
  const ordenes = await prisma.ordenMuebles.findMany({
    where: { id: { in: parsed.data.ordenIds }, deletedAt: null },
    select: { id: true, codigo: true, estado: true, ciudadEnvio: true },
  })
  const noListas = ordenes.filter((o) => o.estado !== 'INSPECCIONADA')
  if (ordenes.length !== parsed.data.ordenIds.length || noListas.length) {
    throw createError({
      statusCode: 409,
      statusMessage: noListas.length
        ? `La orden ${noListas[0]!.codigo} ya no está lista para entregar. Actualiza la pantalla`
        : 'Alguna orden ya no existe. Actualiza la pantalla',
    })
  }

  await prisma.ordenMuebles.updateMany({
    where: { id: { in: ordenes.map((o) => o.id) }, estado: 'INSPECCIONADA' },
    data: { estado: 'ENTREGADA_TRANSPORTE', entregadaTransporteAt: now, entregadaPorId: actor.id },
  })

  for (const o of ordenes) {
    await auditar(actor.id, 'UPDATE', 'inspeccion-muebles', o.id, `Orden ${o.codigo} entregada a transporte (${o.ciudadEnvio ?? 'sin ciudad'})`)
  }

  return { success: true, entregadas: ordenes.length }
})
