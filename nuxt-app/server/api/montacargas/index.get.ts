import { defineEventHandler, getQuery, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { sanearPaginacion } from '../../utils/paginacion'
import { mapMovimientoMontacargas } from '../../utils/mapRow'
import { assertUsuarioMontacargas, buildMovimientoWhere, MOVIMIENTO_INCLUDE } from '../../utils/montacargas'
import { esTipoMovimiento } from '../../utils/montacargasCalc'
import { conCargaMovimientos } from '../../utils/carga'

// GET /api/montacargas?tipo=RECEPCION|MOVIMIENTO|RESURTIDO
// Listado paginado. Un MONTACARGAS solo ve los suyos.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioMontacargas(actor.role)

  const sp = getQuery(event)
  const str = (v: unknown) => (v === undefined || v === null ? undefined : String(v).trim() || undefined)

  // `tipo` es obligatorio: sin el, Resurtido mostraria los movimientos de
  // deposito y al reves.
  const tipo = str(sp.tipo)
  if (!esTipoMovimiento(tipo)) {
    throw createError({ statusCode: 400, statusMessage: 'Tipo de registro invalido' })
  }

  const { page, pageSize } = sanearPaginacion(sp.page, sp.pageSize, 25, 100)
  const where = buildMovimientoWhere(actor, tipo, {
    q: str(sp.q),
    fecha: str(sp.fecha),
    usuarioId: str(sp.usuarioId),
    estado: str(sp.estado),
  })

  const [items, total] = await Promise.all([
    prisma.movimientoMontacargas.findMany({
      where: where as never,
      include: MOVIMIENTO_INCLUDE,
      orderBy: [{ horaInicio: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.movimientoMontacargas.count({ where: where as never }),
  ])

  return { success: true, data: await conCargaMovimientos(items.map(mapMovimientoMontacargas)), total, page, pageSize }
})
