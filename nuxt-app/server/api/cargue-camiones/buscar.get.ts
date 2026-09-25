import { defineEventHandler, getQuery, createError } from 'h3'
import { buscarOrdenCargue, requireCargue } from '../../utils/cargueCamion'
import { validarCodigoCargue } from '../../utils/cargueCamionCalc'

/**
 * GET /api/cargue-camiones/buscar?codigo=OVDM121831 - lo que trae la orden
 * antes de subirla: tienda, cliente, ciudad y bultos declarados por Cargue
 * Gourmet y por Muebles. `origen: MANUAL` = no existe en ninguno.
 */
export default defineEventHandler(async (event) => {
  await requireCargue(event)
  const codigo = String(getQuery(event).codigo ?? '')
  const error = validarCodigoCargue(codigo)
  if (error) throw createError({ statusCode: 400, statusMessage: error })
  return { success: true, data: await buscarOrdenCargue(codigo) }
})
