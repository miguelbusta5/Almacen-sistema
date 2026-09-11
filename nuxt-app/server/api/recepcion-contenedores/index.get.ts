import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { mapRecepcion } from '../../utils/mapRow'
import { assertUsuarioRecepcion, RECEPCION_INCLUDE, whereScopeRecepcion } from '../../utils/recepcion'
import { sanearPaginacion } from '../../utils/paginacion'
import { parseDay } from '../../utils/exportacionesCalc'

// GET /api/recepcion-contenedores - listado paginado con filtros.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioRecepcion(actor.role)

  const sp = getQuery(event)
  // sanearPaginacion devuelve pagina y tamano, no `skip`: leerlo de ahi daba
  // undefined y la pagina 2 repetia la 1.
  const { page, pageSize } = sanearPaginacion(sp.page, sp.pageSize)

  const q = String(sp.q ?? '').trim()
  const estado = String(sp.estado ?? '').trim()
  const fecha = parseDay(sp.fecha ? String(sp.fecha) : null)

  const where = {
    ...whereScopeRecepcion(actor),
    deletedAt: null,
    ...(estado === 'en-curso' && { estado: 'EN_CURSO' as const }),
    ...(estado === 'cerrado' && { estado: 'CERRADO' as const }),
    ...(estado === 'novedad' && { novedades: { some: {} } }),
    ...(fecha && { fecha }),
    ...(q && {
      OR: [
        { numeroPedido: { contains: q, mode: 'insensitive' as const } },
        { proveedor: { contains: q, mode: 'insensitive' as const } },
      ],
    }),
  }

  const [rows, total] = await Promise.all([
    prisma.recepcionContenedor.findMany({
      where,
      include: RECEPCION_INCLUDE,
      orderBy: { horaInicio: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.recepcionContenedor.count({ where }),
  ])

  return { success: true, data: rows.map(mapRecepcion), total, page, pageSize }
})
