import { readBody, createError } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import { assertPuedePausar, finalizarPausa } from '../../utils/pausasOperativas'
import { defineOperacionAlmacenHandler } from '../../utils/operacionAlmacen'

const schema = z.object({ pausaId: z.string().min(1) })
export default defineOperacionAlmacenHandler(async (event) => {
  const actor = await requireAuth(event)
  assertPuedePausar(actor.role)
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Indica la pausa que quieres finalizar' })
  await finalizarPausa(actor.id, parsed.data.pausaId)
  return { success: true, data: null }
}, true)
