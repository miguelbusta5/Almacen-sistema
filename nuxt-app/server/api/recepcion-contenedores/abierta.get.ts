import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { mapRecepcion } from '../../utils/mapRow'
import { assertUsuarioRecepcion, RECEPCION_INCLUDE } from '../../utils/recepcion'

/**
 * GET /api/recepcion-contenedores/abierta - la planilla que el actor tiene en
 * curso, si la hay.
 *
 * Endpoint aparte y no derivado del listado: la planilla abierta tiene que
 * sobrevivir a filtros, paginacion y a recargar la pagina. Es lo que permite
 * cerrar el contenedor volviendo a entrar horas despues.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioRecepcion(actor.role)

  const row = await prisma.recepcionContenedor.findFirst({
    where: { creadoPorId: actor.id, estado: 'EN_CURSO', deletedAt: null },
    include: RECEPCION_INCLUDE,
    orderBy: { horaInicio: 'desc' },
  })

  return { success: true, data: row ? mapRecepcion(row) : null }
})
