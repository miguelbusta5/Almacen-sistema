import { defineEventHandler } from 'h3'
import { requireAuth } from '../../utils/auth'
import { assertUsuarioMontacargas, listarAyudantes } from '../../utils/montacargas'

// GET /api/montacargas/ayudantes - quien puede recibir un PLU, con su carga
// pendiente, para que el operario reparta con criterio en vez de a ciegas.
//
// Incluye a los montacarguistas: tambien hacen de ayudantes. Sale el actor
// mismo, que no puede pasarse el PLU a si mismo.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioMontacargas(actor.role)

  return { success: true, data: await listarAyudantes(actor.id) }
})
