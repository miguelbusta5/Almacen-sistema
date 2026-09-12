// Acceso a datos de Picking e Inspeccion de Muebles: includes, lecturas y
// auditoria. La logica pura vive en mueblesCalc.ts.
import { createError } from 'h3'
import type { H3Event } from 'h3'
import { prisma } from './prisma'
import { requireAuth, type SessionUser } from './auth'
import { capacidadEquipo, puedeInspeccionar, puedePickear, type CapacidadEquipo } from './mueblesCalc'
import { todayBogota } from './exportacionesCalc'

export const LINEA_SELECT = {
  id: true,
  plu: true,
  descripcion: true,
  partes: true,
  pesoUnitarioKg: true,
  volumenUnitarioM3: true,
  unidades: true,
  ubicacion: true,
  numeroCaja: true,
  volumenTotalM3: true,
  pesoTotalKg: true,
  estado: true,
  horaInicio: true,
  horaFin: true,
  inspHoraInicio: true,
  inspHoraFin: true,
  ebanisteriaInicio: true,
  ebanisteriaFin: true,
  motivoEbanisteria: true,
  inspector: { select: { id: true, nombre: true } },
  enviadoEbanisteriaPor: { select: { id: true, nombre: true } },
  recibidoEbanisteriaPor: { select: { id: true, nombre: true } },
} as const

export const ORDEN_INCLUDE = {
  operario: { select: { id: true, name: true } },
  equipo: { select: { id: true, codigo: true, tipo: true, capacidadM3: true, capacidadKg: true } },
  inspector: { select: { id: true, nombre: true } },
  lineas: { select: LINEA_SELECT, orderBy: { horaInicio: 'asc' } },
} as const

export async function requirePicking(event: H3Event): Promise<SessionUser> {
  const actor = await requireAuth(event)
  if (!puedePickear(actor.role)) {
    throw createError({ statusCode: 403, statusMessage: 'No tienes permisos de picking de muebles' })
  }
  return actor
}

export async function requireInspeccion(event: H3Event): Promise<SessionUser> {
  const actor = await requireAuth(event)
  if (!puedeInspeccionar(actor.role)) {
    throw createError({ statusCode: 403, statusMessage: 'No tienes permisos de inspeccion de muebles' })
  }
  return actor
}

/** Equipo que el operario tiene asignado HOY. Null si nadie se lo asigno. */
export async function equipoDelDia(usuarioId: string) {
  const asignacion = await prisma.asignacionEquipoMuebles.findUnique({
    where: { usuarioId_fecha: { usuarioId, fecha: todayBogota() } },
    include: { equipo: true },
  })
  return asignacion?.equipo ?? null
}

/** La orden que el operario tiene abierta. Solo puede haber una. */
export async function ordenAbierta(operarioId: string) {
  return prisma.ordenMuebles.findFirst({
    where: { operarioId, estado: 'EN_PICKING', deletedAt: null },
    include: ORDEN_INCLUDE,
  })
}

export async function ordenPorId(id: string) {
  const orden = await prisma.ordenMuebles.findFirst({
    where: { id, deletedAt: null },
    include: ORDEN_INCLUDE,
  })
  if (!orden) throw createError({ statusCode: 404, statusMessage: 'Orden no encontrada' })
  return orden
}

type OrdenConLineas = { equipo: { capacidadM3: unknown } | null; lineas: Array<{
  volumenTotalM3: unknown
  pesoTotalKg: unknown
  horaFin: Date | null
}> }

/**
 * Carga del equipo para una orden. Se calcula sobre las lineas de LA ORDEN
 * ABIERTA: al pasarla a inspeccion el operario descarga, asi que la capacidad
 * vuelve a cero sola, sin un campo que alguien tenga que acordarse de resetear.
 */
export function capacidadDeOrden(orden: OrdenConLineas | null): CapacidadEquipo {
  const lineas = (orden?.lineas ?? []).map((l) => ({
    volumenTotalM3: l.volumenTotalM3 == null ? null : Number(l.volumenTotalM3),
    pesoTotalKg: l.pesoTotalKg == null ? null : Number(l.pesoTotalKg),
    horaFin: l.horaFin,
  }))
  const cap = orden?.equipo?.capacidadM3
  return capacidadEquipo(lineas, cap == null ? null : Number(cap))
}

/**
 * Bitacora. Nunca bloqueante: si falla el log, el trabajo del operario no se
 * pierde (mismo criterio que el resto del proyecto).
 */
export function auditar(
  userId: string,
  action: string,
  module: 'picking-muebles' | 'inspeccion-muebles',
  recordId: string,
  details: string,
) {
  return prisma.activityLog
    .create({ data: { userId, action, module, recordId, details } })
    .catch(() => {})
}
