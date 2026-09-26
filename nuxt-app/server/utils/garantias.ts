import { prisma } from './prisma'
import { minutosTarea } from './garantiasCalc'

export const GESTORES_GARANTIAS = ['ADMIN', 'GERENTE'] as const
export const ROLES_GARANTIAS = ['GARANTIAS', ...GESTORES_GARANTIAS] as const
export function esGestor(role: string) { return (GESTORES_GARANTIAS as readonly string[]).includes(role) }
export const INCLUDE_GARANTIA = { usuario: { select: { id: true, name: true } }, tramos: { orderBy: { inicio: 'asc' as const } } }

export function mapGarantia(t: any, gestor: boolean) {
  const base = {
    id: t.id, usuarioId: t.usuarioId, operario: t.usuario?.name ?? '',
    tipo: t.tipo, numeroCaso: t.numeroCaso, observacion: t.observacion,
    plu: t.plu, descripcion: t.descripcion, proveedor: t.proveedor, estado: t.estado,
  }
  if (!gestor) return base
  return {
    ...base, horaInicio: t.horaInicio.toISOString(), horaFin: t.horaFin?.toISOString() ?? null,
    tramos: t.tramos.map((x: any) => ({ id: x.id, inicio: x.inicio.toISOString(), fin: x.fin?.toISOString() ?? null })),
    minutos: t.horaFin ? Math.round(minutosTarea(t.tramos.filter((x: any) => x.fin)) * 10) / 10 : null,
  }
}

export function auditarGarantia(userId: string, action: string, recordId: string, details: string) {
  return prisma.activityLog.create({ data: { userId, action, module: 'garantias', recordId, details } })
}
