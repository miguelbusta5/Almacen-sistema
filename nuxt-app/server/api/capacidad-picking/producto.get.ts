import { defineEventHandler, getQuery, createError } from 'h3'
import { requireAuth } from '../../utils/auth'
import { datosMaestro, exigirPicking } from '../../utils/picking'
import { prisma } from '../../utils/prisma'
import { textoPicking } from '../../utils/pickingCalc'
import { resolverPluMaestro } from '../../utils/codigoProducto'

// GET /api/capacidad-picking/producto?plu= - lo que dice el maestro de un PLU
// mientras se digita en el informe: descripcion y unidad de empaque. La unidad
// es solo lectura; si esta mal, se corrige en el maestro.
export default defineEventHandler(async event => {
  const actor = await requireAuth(event); await exigirPicking(actor)
  const plu = await resolverPluMaestro(textoPicking(getQuery(event).plu))
  if (!plu || plu.length > 100) throw createError({ statusCode: 400, statusMessage: 'Escribe un PLU' })
  const dato = (await datosMaestro(prisma, [plu])).get(plu)
  if (!dato) throw createError({ statusCode: 404, statusMessage: 'PLU no encontrado en el maestro' })
  return { plu, ...dato }
})
