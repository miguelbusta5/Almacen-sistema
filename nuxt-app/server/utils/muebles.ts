// Acceso a datos de Picking e Inspeccion de Muebles: includes, lecturas y
// auditoria. La logica pura vive en mueblesCalc.ts.
import { createError } from 'h3'
import type { H3Event } from 'h3'
import { prisma } from './prisma'
import { requireAuth, type SessionUser } from './auth'
import { puedeInspeccionar, puedePickear, volumenOrden, type VolumenOrden } from './mueblesCalc'
import { todayBogota } from './exportacionesCalc'
import { assertSinPausa } from './operacionAlmacen'

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
  inspPausaInicio: true,
  inspPausaSegundos: true,
  averiado: true,
  motivoAveria: true,
  reposicionInicio: true,
  reposicionFin: true,
  ebanisteriaInicio: true,
  ebanisteriaFin: true,
  motivoEbanisteria: true,
  inspector: { select: { id: true, nombre: true } },
  enviadoEbanisteriaPor: { select: { id: true, nombre: true } },
  recibidoEbanisteriaPor: { select: { id: true, nombre: true } },
  operarioId: true,
  operario: { select: { id: true, name: true } },
} as const

export const ORDEN_INCLUDE = {
  operario: { select: { id: true, name: true } },
  equipo: { select: { id: true, codigo: true, tipo: true } },
  inspector: { select: { id: true, nombre: true } },
  entregadaPor: { select: { id: true, name: true } },
  // Quien esta dentro de la orden: una TSDM la revisan varios a la vez.
  inspectores: { include: { inspector: { select: { id: true, nombre: true } } }, orderBy: { seUnioAt: 'asc' } },
  lineas: { select: LINEA_SELECT, orderBy: { horaInicio: 'asc' } },
  // Ordenados por cuando entraron: el ultimo es quien cierra la orden.
  participantes: {
    include: {
      usuario: { select: { id: true, name: true } },
      equipo: { select: { id: true, codigo: true, tipo: true } },
    },
    orderBy: { seUnioAt: 'asc' },
  },
} as const

export async function requirePicking(event: H3Event): Promise<SessionUser> {
  const actor = await requireAuth(event)
  if (!puedePickear(actor.role)) {
    throw createError({ statusCode: 403, statusMessage: 'No tienes permisos de picking de muebles' })
  }
  return actor
}

/**
 * Igual que requirePicking, pero rechaza mientras la persona esta en pausa.
 *
 * Solo para lo que escribe: durante el almuerzo la orden esta detenida, asi que
 * escanear un PLU volveria a meter tiempo en un reloj parado.
 */
export async function requirePickingActivo(event: H3Event): Promise<SessionUser> {
  const actor = await requirePicking(event)
  await assertSinPausa(actor.id)
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

/**
 * La orden que el operario tiene abierta. Solo puede haber una.
 *
 * Busca por PARTICIPANTE y no por creador: unirse a la orden de otro (el caso de
 * un PLU reasignado) tambien ocupa tu turno, asi que mientras estes dentro no
 * puedes abrir una propia.
 */
export async function ordenAbierta(usuarioId: string) {
  return prisma.ordenMuebles.findFirst({
    where: {
      estado: 'EN_PICKING',
      deletedAt: null,
      participantes: { some: { usuarioId } },
    },
    include: ORDEN_INCLUDE,
  })
}

/** true si esa persona trabaja la orden (la creo o se unio). */
export function esParticipante(
  orden: { participantes: Array<{ usuarioId: string }> },
  usuarioId: string,
): boolean {
  return orden.participantes.some((p) => p.usuarioId === usuarioId)
}

export async function ordenPorId(id: string) {
  const orden = await prisma.ordenMuebles.findFirst({
    where: { id, deletedAt: null },
    include: ORDEN_INCLUDE,
  })
  if (!orden) throw createError({ statusCode: 404, statusMessage: 'Orden no encontrada' })
  return orden
}

type OrdenConLineas = {
  lineas: Array<{
    volumenTotalM3: unknown
    pesoTotalKg: unknown
    horaFin: Date | null
  }>
}

/**
 * m3 y kg que lleva acumulados la orden.
 *
 * Ya no hay capacidad del equipo contra la que comparar: el area decidio no
 * medir el Order Picker ni el Genie. Queda la cifra, que es lo que pidieron.
 */
export function volumenDeOrden(orden: OrdenConLineas | null): VolumenOrden {
  const lineas = (orden?.lineas ?? []).map((l) => ({
    volumenTotalM3: l.volumenTotalM3 == null ? null : Number(l.volumenTotalM3),
    pesoTotalKg: l.pesoTotalKg == null ? null : Number(l.pesoTotalKg),
    horaFin: l.horaFin,
  }))
  return volumenOrden(lineas)
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
