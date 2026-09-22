import { createError } from 'h3'
import type { SessionUser } from './auth'
import { prisma } from './prisma'

export async function accesoInventarios(userId: string) {
  const usuario = await prisma.user.findUnique({ where: { id: userId }, select: { active: true, role: true } })
  if (!usuario?.active || !['ADMIN', 'SUPERVISOR_INVENTARIO', 'INVENTARIO', 'GERENTE', 'OPERADOR'].includes(usuario.role)) return false
  // El administrador puede lo mismo que quien tiene el permiso por persona, sin
  // tener que darse acceso a si mismo (misma regla que montar resurtido).
  if (usuario.role === 'ADMIN') return true
  return !!(await prisma.inventarioAcceso.findUnique({ where: { userId } }))?.gestionar
}

export async function exigirInventarios(actor: SessionUser) {
  if (!await accesoInventarios(actor.id)) throw createError({ statusCode: 403, statusMessage: 'Sin permiso para gestionar cronogramas de inventarios' })
}

export async function permisosInventarios(id: string) {
  const u = await prisma.user.findUnique({ where: { id }, select: { active: true, role: true } })
  const p = u?.active ? await prisma.inventarioAcceso.findUnique({ where: { userId: id } }) : null
  // Gestionar si, contar no: el admin no cuenta ubicaciones, y si lo marcara
  // saldria en la lista de operarios a los que se les asignan.
  const admin = u?.active === true && u.role === 'ADMIN'
  return { gestionar: admin || !!p?.gestionar, contar: !!p?.contar }
}
