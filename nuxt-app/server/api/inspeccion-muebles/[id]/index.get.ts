import { defineEventHandler, getRouterParam } from 'h3'
import { ordenPorId, requireInspeccion } from '../../../utils/muebles'
import { mapOrdenMuebles } from '../../../utils/mapRow'

/**
 * GET /api/inspeccion-muebles/:id - detalle de la orden.
 *
 * Todo el estado (que PLU va por donde, que relojes corren) vive en la DB, asi
 * que un inspector que sale y vuelve encuentra la orden donde la dejo. No hay
 * nada en memoria del cliente que se pueda perder.
 */
export default defineEventHandler(async (event) => {
  await requireInspeccion(event)
  const orden = await ordenPorId(getRouterParam(event, 'id')!)
  return { success: true, data: mapOrdenMuebles(orden) }
})
