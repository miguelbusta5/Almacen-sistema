import { defineEventHandler, getQuery, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { mapMovimientoMontacargas } from '../../utils/mapRow'
import { assertUsuarioMontacargas, MOVIMIENTO_INCLUDE } from '../../utils/montacargas'
import { esTipoMovimiento } from '../../utils/montacargasCalc'

// GET /api/montacargas/abiertos?tipo=... - los registros que el actor tiene en
// la mano ahora mismo (en curso o con novedad).
//
// Plural: en resurtido pueden ser varios a la vez. Endpoint aparte y no derivado
// de la lista a proposito: la bandeja tiene que sobrevivir a filtros, paginacion
// y a recargar la pagina.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioMontacargas(actor.role)

  const tipo = String(getQuery(event).tipo ?? '').trim()
  if (!esTipoMovimiento(tipo)) {
    throw createError({ statusCode: 400, statusMessage: 'Tipo de registro invalido' })
  }

  const rows = await prisma.movimientoMontacargas.findMany({
    where: {
      responsableId: actor.id,
      tipo,
      estado: { in: ['EN_CURSO', 'NOVEDAD'] },
      deletedAt: null,
    },
    include: MOVIMIENTO_INCLUDE,
    orderBy: { horaInicio: 'asc' },
  })

  return { success: true, data: rows.map(mapMovimientoMontacargas) }
})
