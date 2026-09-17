import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { mapMontaje } from '../../utils/mapRow'
import { assertVeMontaje, MONTAJE_INCLUDE } from '../../utils/resurtido'
import { limitesRango } from '../../utils/indicadoresCalc'

const RE_DIA = /^\d{4}-\d{2}-\d{2}$/

// GET /api/montaje-resurtido - los resurtidos montados, mas recientes primero.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertVeMontaje(actor.role)

  const sp = getQuery(event)
  const soloAbiertos = String(sp.estado ?? '') === 'en-curso'
  // Rango por fecha de montaje (dias de Bogota). Sin rango: los mas recientes.
  const desde = RE_DIA.test(String(sp.desde ?? '')) ? String(sp.desde) : null
  const hasta = RE_DIA.test(String(sp.hasta ?? '')) ? String(sp.hasta) : desde
  const rango = desde && hasta ? limitesRango(desde <= hasta ? desde : hasta, desde <= hasta ? hasta : desde) : null

  const rows = await prisma.montajeResurtido.findMany({
    where: {
      deletedAt: null,
      ...(soloAbiertos && { estado: 'EN_CURSO' as const }),
      ...(rango && { montadoAt: { gte: rango.inicio, lte: rango.fin } }),
    },
    include: MONTAJE_INCLUDE,
    orderBy: { montadoAt: 'desc' },
    take: rango ? 300 : 60,
  })

  return { success: true, data: rows.map(mapMontaje) }
})
