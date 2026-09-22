import { createError } from 'h3'
import type { SessionUser } from './auth'
import { prisma } from './prisma'

export async function accesoInventarios(userId: string) {
  const usuario = await prisma.user.findUnique({ where: { id: userId }, select: { active: true, role: true } })
  if (!usuario?.active || !['ADMIN', 'SUPERVISOR_INVENTARIO', 'INVENTARIO', 'GERENTE', 'OPERADOR'].includes(usuario.role)) return false
  return !!(await prisma.inventarioAcceso.findUnique({ where: { userId } }))?.gestionar
}

export async function exigirInventarios(actor: SessionUser) {
  if (!await accesoInventarios(actor.id)) throw createError({ statusCode: 403, statusMessage: 'Sin permiso para gestionar cronogramas de inventarios' })
}

export async function permisosInventarios(id: string) {
  const u = await prisma.user.findUnique({ where: { id }, select: { active: true } })
  const p = u?.active ? await prisma.inventarioAcceso.findUnique({ where: { userId: id } }) : null
  return { gestionar: !!p?.gestionar, contar: !!p?.contar }
}
