import { defineEventHandler } from 'h3'
import { requireAuth } from '../../utils/auth'
import { assertUsuarioMontacargas, listarAyudantes } from '../../utils/montacargas'

// GET /api/montacargas/ayudantes - operarios de almacenamiento activos con su
// carga pendiente, para que el operario reparta con criterio en vez de a ciegas.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioMontacargas(actor.role)

  return { success: true, data: await listarAyudantes() }
})
