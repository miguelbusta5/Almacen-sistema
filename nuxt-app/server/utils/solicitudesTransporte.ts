// Utilidades de servidor de Solicitudes Transporte que SÍ tocan Prisma.
// Los helpers puros y los catálogos viven en solicitudesTransporteCalc.ts (que
// consume mapRow.ts) — no mover nada de aquí allí.
import { prisma } from './prisma'
import {
  calcularPrioridadSolicitudTransporte,
  calcularSemaforoSolicitudTransporte,
  mesSolicitud,
  puedeGestionarSolicitudTransporte,
  SOLICITUDES_TRANSPORTE_PATH,
  type StellaEstado,
} from './solicitudesTransporteCalc'

export const SOLICITUD_INCLUDE = {
  creadoPor: { select: { name: true } },
  gestionadoPor: { select: { name: true } },
  plines: true,
} as const

export interface FiltrosSolicitud {
  q?: string
  estado?: string | null
  prioridad?: string | null
  semaforo?: string | null
  area?: string
}

/**
 * Construye el `where` del listado. Recibe el actor OBLIGATORIAMENTE para que sea
 * imposible olvidar el filtro por dueño: sin él, seis roles verían las solicitudes
 * de todas las áreas.
 *
 * `omitir` permite excluir un filtro concreto — lo usan los groupBy de KPIs, que
 * deben contar sobre el resto de filtros pero no sobre el que la propia tarjeta
 * aplica (si no, al filtrar por RECHAZADA el resto de KPIs se irían a cero).
 */
export function buildWhereSolicitud(
  actor: { id: string; role: string },
  f: FiltrosSolicitud,
  omitir?: 'estado' | 'semaforo',
): Record<string, unknown> {
  const esGestor = puedeGestionarSolicitudTransporte(actor.role)
  return {
    deletedAt: null,
    ...(esGestor ? {} : { creadoPorId: actor.id }),
    ...(f.estado && omitir !== 'estado' ? { estado: f.estado } : {}),
    ...(f.prioridad ? { prioridad: f.prioridad } : {}),
    ...(f.semaforo && omitir !== 'semaforo' ? { semaforo: f.semaforo } : {}),
    ...(f.area ? { areaSolicitante: f.area } : {}),
    ...(f.q
      ? {
          OR: [
            { solicitanteNombre: { contains: f.q, mode: 'insensitive' } },
            { numeroPedido: { contains: f.q, mode: 'insensitive' } },
            { ciudadEntrega: { contains: f.q, mode: 'insensitive' } },
            { transportadora: { contains: f.q, mode: 'insensitive' } },
            { numeroGuia: { contains: f.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }
}

export function buildCalculatedFields(input: {
  fechaSolicitud: Date
  fechaPromesaEntrega: Date | null
  stellaEstado?: StellaEstado
}) {
  const stellaEstado = input.stellaEstado ?? 'PENDIENTE'
  return {
    prioridad: calcularPrioridadSolicitudTransporte(input.fechaSolicitud, input.fechaPromesaEntrega),
    semaforo: calcularSemaforoSolicitudTransporte({ stellaEstado, fechaPromesaEntrega: input.fechaPromesaEntrega }),
    mesSolicitud: mesSolicitud(input.fechaSolicitud),
  }
}

export async function notifyGestores(
  recordId: string,
  actorId: string,
  titulo: string,
  descripcion: string,
) {
  const gestores = await prisma.user.findMany({
    where: { active: true, role: { in: ['ADMIN', 'GERENTE', 'SUPERVISOR_TRANSPORTE'] }, id: { not: actorId } },
    select: { id: true },
  })
  if (gestores.length === 0) return
  await prisma.notificacion.createMany({
    data: gestores.map((u) => ({
      userId: u.id,
      titulo,
      descripcion,
      tipo: 'SOLICITUD_TRANSPORTE',
      enlace: `${SOLICITUDES_TRANSPORTE_PATH}?id=${recordId}`,
    })),
  }).catch(() => {})
}

export async function notifyCreador(
  recordId: string,
  creadoPorId: string,
  titulo: string,
  descripcion: string,
) {
  await prisma.notificacion.create({
    data: {
      userId: creadoPorId,
      titulo,
      descripcion,
      tipo: 'SOLICITUD_TRANSPORTE',
      enlace: `${SOLICITUDES_TRANSPORTE_PATH}?id=${recordId}`,
    },
  }).catch(() => {})
}

export async function logSolicitud(
  actorId: string,
  action: string,
  recordId: string,
  details: string,
) {
  await prisma.activityLog.create({
    data: { userId: actorId, action, module: 'solicitudes-transporte', recordId, details },
  }).catch(() => {})
}
