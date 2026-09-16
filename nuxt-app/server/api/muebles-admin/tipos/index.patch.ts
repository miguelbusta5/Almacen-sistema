import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireRole } from '../../../utils/auth'
import { ROLES_GESTION_MUEBLES, TIPOS_MERCANCIA_MUEBLE } from '../../../utils/mueblesCalc'
import { auditar } from '../../../utils/muebles'
import { normalizePlu } from '../../../utils/exportacionesCalc'
import { resolverPluMaestro } from '../../../utils/codigoProducto'

const schema = z.object({
  plu: z.string().min(1).max(100),
  tipo: z.enum(TIPOS_MERCANCIA_MUEBLE),
})

/**
 * PATCH /api/muebles-admin/tipos - corrige el tipo de un PLU.
 *
 * Queda en MANUAL, y a partir de ahi la heuristica ya no lo toca. El cambio
 * arregla el informe TAMBIEN hacia atras, porque los indicadores resuelven el
 * tipo por PLU en vez de leerlo sellado en cada linea: una mala clasificacion no
 * puede quedarse en el historico para siempre.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, ROLES_GESTION_MUEBLES)

  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const plu = await resolverPluMaestro(normalizePlu(parsed.data.plu))

  const fila = await prisma.tipoMueblePlu.upsert({
    where: { plu },
    create: { plu, tipo: parsed.data.tipo, origen: 'MANUAL', actualizadoPorId: actor.id },
    update: { tipo: parsed.data.tipo, origen: 'MANUAL', actualizadoPorId: actor.id },
  })

  await auditar(actor.id, 'UPDATE', 'picking-muebles', plu, `PLU ${plu} clasificado como ${parsed.data.tipo}`)

  return { success: true, data: fila }
})
