import { defineEventHandler, getQuery, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { mapMovimientoMontacargas } from '../../utils/mapRow'
import { assertUsuarioMontacargas, MOVIMIENTO_INCLUDE, puedeResolverNovedades } from '../../utils/montacargas'
import { esTipoMovimiento } from '../../utils/montacargasCalc'
import { conCargaMovimientos } from '../../utils/carga'

// GET /api/montacargas/abiertos?tipo=... - lo que el actor tiene que atender.
//
// Son dos cosas: los registros que tiene en la mano, y -si puede cerrar
// novedades- las que estan esperando verificacion aunque las tenga otro. Sin lo
// segundo, quien tiene el permiso veia la novedad en el listado pero nunca el
// boton de verificar, porque la tarjeta solo salia en la bandeja del responsable.
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

  const puedeVerificar = await puedeResolverNovedades(actor.id)

  const rows = await prisma.movimientoMontacargas.findMany({
    where: {
      tipo,
      deletedAt: null,
      OR: [
        { responsableId: actor.id, estado: { in: ['EN_CURSO', 'NOVEDAD'] } },
        ...(puedeVerificar ? [{ estado: 'NOVEDAD' as const }] : []),
      ],
    },
    include: MOVIMIENTO_INCLUDE,
    orderBy: { horaInicio: 'asc' },
  })

  return { success: true, data: await conCargaMovimientos(rows.map(mapMovimientoMontacargas)) }
})
