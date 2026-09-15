import { readBody, createError } from 'h3'
import { z } from 'zod'
import { requireAuth } from '../../utils/auth'
import { assertPuedePausar, iniciarPausa } from '../../utils/pausasOperativas'
import { defineOperacionAlmacenHandler } from '../../utils/operacionAlmacen'

const schema = z.object({ motivo: z.enum(['ALIMENTACION', 'CAMBIO_BATERIAS']) })
export default defineOperacionAlmacenHandler(async (event) => {
  const actor = await requireAuth(event)
  assertPuedePausar(actor.role)
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Selecciona alimentación o cambio de baterías' })
  return { success: true, data: await iniciarPausa(actor.id, parsed.data.motivo) }
}, true)
