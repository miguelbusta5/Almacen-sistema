import { defineEventHandler } from 'h3'
import { requireAuth } from '../../utils/auth'
import { assertVeMontaje, listarOperarios } from '../../utils/resurtido'

// GET /api/montaje-resurtido/operarios - a quien se le puede asignar.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertVeMontaje(actor.role)
  return { success: true, data: await listarOperarios() }
})
