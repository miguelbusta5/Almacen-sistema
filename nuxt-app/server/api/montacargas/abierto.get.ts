import { defineEventHandler, getQuery, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { mapMovimientoMontacargas } from '../../utils/mapRow'
import { assertUsuarioMontacargas, MOVIMIENTO_INCLUDE } from '../../utils/montacargas'
import { esTipoMovimiento } from '../../utils/montacargasCalc'

// GET /api/montacargas/abierto?tipo=... - el registro en curso del actor.
// Endpoint aparte y no derivado de la lista a proposito: el paso "asignar
// ubicacion" tiene que sobrevivir a filtros, paginacion y a recargar la pagina.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioMontacargas(actor.role)

  const tipo = String(getQuery(event).tipo ?? '').trim()
  if (!esTipoMovimiento(tipo)) {
    throw createError({ statusCode: 400, statusMessage: 'Tipo de registro invalido' })
  }

  const row = await prisma.movimientoMontacargas.findFirst({
    where: { creadoPorId: actor.id, tipo, horaFinalizacion: null, deletedAt: null },
    include: MOVIMIENTO_INCLUDE,
    orderBy: [{ horaInicio: 'desc' }],
  })

  return { success: true, data: row ? mapMovimientoMontacargas(row) : null }
})
