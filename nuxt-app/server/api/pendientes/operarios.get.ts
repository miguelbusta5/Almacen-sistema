import { defineEventHandler } from 'h3'
import { requireAuth } from '../../utils/auth'
import { assertVePendientes, listarOperarios } from '../../utils/resurtido'

// GET /api/pendientes/operarios - a quien se le puede asignar un pendiente.
//
// Propio de Pendientes y no el de Montaje Resurtido: ese es solo de supervision,
// y a quien pide (Viviana) le respondia 403 y le dejaba el selector vacio, aunque
// ella tambien reparte lo suyo. Son las mismas personas que acepta asignar.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertVePendientes(actor.role)
  return { success: true, data: await listarOperarios() }
})
