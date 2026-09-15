import { defineEventHandler, getQuery, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { esSolicitante } from '../../utils/resurtidoCalc'
import { normalizePlu } from '../../utils/exportacionesCalc'
import { buscarPendienteSumable, resurtidoDelPlu } from '../../utils/pendientesSolicitud'

/**
 * GET /api/pendientes/consulta?plu= - antes de pedir un pendiente.
 *
 * Dice si el PLU tiene un resurtido abierto o se resurtio en las ultimas 2
 * horas (quien pide debe confirmar antes de solicitar igual) y si ya hay un
 * pendiente del mismo PLU sin empezar, al que se sumara la solicitud.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  if (!esSolicitante(actor.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Solo operaciones gourmet solicita pendientes' })
  }
  const plu = normalizePlu(String(getQuery(event).plu ?? ''))
  if (!plu) throw createError({ statusCode: 400, statusMessage: 'Escribe un PLU' })

  const [resurtido, existente] = await Promise.all([
    resurtidoDelPlu(prisma, plu),
    buscarPendienteSumable(prisma, plu),
  ])
  return {
    success: true,
    data: {
      plu,
      resurtido,
      pendienteExistente: existente
        ? {
            id: existente.id,
            estado: existente.estado,
            unidadesSolicitadas: existente.unidadesSolicitadas,
            operarioNombre: existente.operario?.name ?? null,
            enResurtido: Boolean(existente.tareaResurtidoId),
          }
        : null,
    },
  }
})
