import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireRole } from '../../../utils/auth'
import { ROLES_GESTION_MUEBLES } from '../../../utils/mueblesCalc'

/**
 * GET /api/muebles-admin/tipos - PLUs clasificados.
 *
 * `?soloDerivados=1` es la cola de revision: lo que dedujo la app y nadie ha
 * confirmado todavia. Es la lista que hay que repasar una vez con el maestro
 * real cargado.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, ROLES_GESTION_MUEBLES)
  const q = getQuery(event)

  const filas = await prisma.tipoMueblePlu.findMany({
    where: {
      ...(q.soloDerivados === '1' ? { origen: 'DERIVADO' as const } : {}),
      ...(typeof q.tipo === 'string' && q.tipo ? { tipo: q.tipo as never } : {}),
      ...(typeof q.plu === 'string' && q.plu ? { plu: { contains: q.plu.trim().toUpperCase() } } : {}),
    },
    orderBy: [{ origen: 'asc' }, { plu: 'asc' }],
    take: 500,
  })

  // La descripcion no vive en esta tabla (el maestro se recarga entero y una FK
  // haria de cada recarga un problema de orden), asi que se junta aparte.
  const maestro = await prisma.productoMaestro.findMany({
    where: { plu: { in: filas.map((f) => f.plu) } },
    select: { plu: true, descripcion: true },
  })
  const desc = new Map(maestro.map((m) => [m.plu, m.descripcion]))

  return {
    success: true,
    data: filas.map((f) => ({
      plu: f.plu,
      tipo: f.tipo,
      origen: f.origen,
      descripcion: desc.get(f.plu) ?? null,
    })),
  }
})
