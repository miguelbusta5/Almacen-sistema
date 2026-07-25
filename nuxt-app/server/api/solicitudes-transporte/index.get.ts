import { defineEventHandler, getQuery, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { mapSolicitudTransporte } from '../../utils/mapRow'
import {
  puedeCrearSolicitudTransporte, puedeGestionarSolicitudTransporte, sanearPaginacion,
} from '../../utils/solicitudesTransporteCalc'
import { estadoSchema, prioridadSchema, semaforoSchema } from '../../utils/solicitudesTransporteSchemas'
import { buildWhereSolicitud, SOLICITUD_INCLUDE, type FiltrosSolicitud } from '../../utils/solicitudesTransporte'

// GET /api/solicitudes-transporte — listado paginado.
// Los no gestores solo ven lo suyo; el filtro vive en buildWhereSolicitud, que exige
// el actor para que no se pueda olvidar.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  if (!puedeCrearSolicitudTransporte(actor.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Sin acceso' })
  }

  const sp = getQuery(event)
  const { page, pageSize } = sanearPaginacion(sp.page, sp.pageSize)
  const str = (v: unknown) => (v === undefined || v === null ? undefined : String(v).trim() || undefined)

  // Un valor inválido se ignora (no es 400), igual que en la app Next.
  const pick = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) => {
    const s = str(v)
    return s && schema.safeParse(s).success ? s : null
  }

  const filtros: FiltrosSolicitud = {
    q: str(sp.q),
    estado: pick(estadoSchema, sp.estado),
    prioridad: pick(prioridadSchema, sp.prioridad),
    semaforo: pick(semaforoSchema, sp.semaforo),
    area: str(sp.area),
  }

  const where = buildWhereSolicitud(actor, filtros)

  // Los KPIs cuentan sobre el resto de filtros pero NO sobre el que la propia
  // tarjeta aplica: si no, al pulsar "Rechazadas" los demás contadores caerían a 0
  // y el rail dejaría de servir para navegar.
  const [rows, total, porEstado, porSemaforo] = await Promise.all([
    prisma.solicitudTransporte.findMany({
      where: where as never,
      include: SOLICITUD_INCLUDE,
      orderBy: [{ updatedAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.solicitudTransporte.count({ where: where as never }),
    prisma.solicitudTransporte.groupBy({
      by: ['estado'],
      where: buildWhereSolicitud(actor, filtros, 'estado') as never,
      _count: { _all: true },
    }),
    prisma.solicitudTransporte.groupBy({
      by: ['semaforo'],
      where: buildWhereSolicitud(actor, filtros, 'semaforo') as never,
      _count: { _all: true },
    }),
  ])

  const kpis: Record<string, number> = {}
  for (const g of porEstado) kpis[g.estado] = g._count._all
  const kpisSemaforo: Record<string, number> = {}
  for (const g of porSemaforo) kpisSemaforo[g.semaforo] = g._count._all

  return {
    success: true,
    data: rows.map(mapSolicitudTransporte),
    total,
    page,
    pageSize,
    kpis,
    kpisSemaforo,
  }
})
