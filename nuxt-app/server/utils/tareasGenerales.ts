// Acceso a datos de Tareas generales. La logica pura vive en
// tareasGeneralesCalc.ts (copia de src/lib/tareasGenerales.ts).
import { createError } from 'h3'
import { prisma } from './prisma'
import { puedeMandarTarea } from './tareasGeneralesCalc'

export const TAREA_GENERAL_INCLUDE = {
  creadoPor: { select: { id: true, name: true } },
  finalizadaPor: { select: { id: true, name: true } },
  asignados: {
    include: {
      usuario: { select: { id: true, name: true } },
      finalizadoPor: { select: { id: true, name: true } },
      apoyaA: { select: { id: true, name: true } },
    },
    orderBy: { horaInicio: 'asc' },
  },
} as const

export function assertPuedeMandarTarea(role: string) {
  if (!puedeMandarTarea(role)) {
    throw createError({ statusCode: 403, statusMessage: 'Solo supervisión asigna tareas generales' })
  }
}

export function mapTareaGeneral(t: any) {
  return {
    id: t.id,
    descripcion: t.descripcion,
    estado: t.estado,
    fecha: t.fecha?.toISOString?.().slice(0, 10) ?? t.fecha ?? null,
    horaInicio: t.horaInicio?.toISOString?.() ?? t.horaInicio ?? null,
    horaFin: t.horaFin?.toISOString?.() ?? t.horaFin ?? null,
    creadoPor: t.creadoPor ? { id: t.creadoPor.id, nombre: t.creadoPor.name } : null,
    finalizadaPor: t.finalizadaPor ? { id: t.finalizadaPor.id, nombre: t.finalizadaPor.name } : null,
    asignados: (t.asignados ?? []).map((a: any) => ({
      id: a.id,
      usuarioId: a.usuarioId,
      nombre: a.usuario?.name ?? '',
      horaInicio: a.horaInicio?.toISOString?.() ?? a.horaInicio ?? null,
      horaFin: a.horaFin?.toISOString?.() ?? a.horaFin ?? null,
      finalizadoPor: a.finalizadoPor ? { id: a.finalizadoPor.id, nombre: a.finalizadoPor.name } : null,
      // Patinador que apoya a un montacarguista: su tiempo tambien le suma a el.
      apoyaA: a.apoyaA ? { id: a.apoyaA.id, nombre: a.apoyaA.name } : null,
    })),
  }
}

export function auditarTarea(userId: string, action: string, recordId: string, details: string) {
  return prisma.activityLog
    .create({ data: { userId, action, module: 'tareas-generales', recordId, details } })
    .catch(() => {})
}
