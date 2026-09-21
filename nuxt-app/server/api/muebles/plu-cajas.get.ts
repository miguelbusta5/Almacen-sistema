import { defineEventHandler, getQuery, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { puedeInspeccionar, puedePickear } from '../../utils/mueblesCalc'
import { textoPicking } from '../../utils/pickingCalc'

/**
 * GET /api/muebles/plu-cajas?plu=19604 - en cuantas cajas viene un PLU.
 *
 * Lo piden Picking (al escanear) e Inspeccion (al iniciar el PLU) para avisar
 * que el mueble viene partido: bajar una caja y dejar la otra en la estanteria
 * es el error que mas se repite.
 *
 * Sale del maestro de medidas, no de lo sellado en la linea: si se corrige una
 * medicion, el aviso queda bien de una vez. Un PLU sin medir devuelve la lista
 * vacia y la pantalla no avisa nada (no se inventa un numero de cajas).
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  if (!puedePickear(actor.role) && !puedeInspeccionar(actor.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Sin acceso a muebles' })
  }

  const plu = textoPicking(getQuery(event).plu)
  if (!plu || plu.length > 100) throw createError({ statusCode: 400, statusMessage: 'PLU requerido' })

  const cajas = await prisma.medidaCajaMaster.findMany({
    where: { plu },
    orderBy: { parte: 'asc' },
    select: { parte: true, altoCm: true, anchoCm: true, profCm: true, pesoBrutoKg: true, volumenM3: true },
  })

  const numero = (v: unknown): number | null => {
    if (v == null) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  return {
    success: true,
    plu,
    partes: cajas.length,
    cajas: cajas.map((c) => ({
      parte: c.parte,
      altoCm: numero(c.altoCm),
      anchoCm: numero(c.anchoCm),
      profCm: numero(c.profCm),
      pesoBrutoKg: numero(c.pesoBrutoKg),
      volumenM3: numero(c.volumenM3),
    })),
  }
})
