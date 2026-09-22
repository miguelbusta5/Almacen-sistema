import { createError, getCookie, type H3Event } from 'h3'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { requireAuth } from './auth'

export const idSolicitud = z.string().uuid()
export const rollosStretch = z.number().int().min(1).max(1000000)
export const pedidoStretch = z.object({ id: idSolicitud, solicitante: z.string().trim().min(3).max(120), destino: z.string().trim().min(2).max(160), tipo: z.enum(['INTERNO', 'TIENDA']), rollos: rollosStretch })
export const hashStretch = (token: string) => createHash('sha256').update(token).digest('hex')
export const COOKIE_STRETCH = 'cedi-stretch'
/**
 * El permiso de una persona, en un solo sitio.
 *
 * El administrador puede lo mismo que Eduardo y Felipe sin darse acceso a si
 * mismo (misma regla que montar resurtido). Vive aparte porque lo necesitan dos
 * caminos distintos: el actor de una peticion y el CREADOR de una pantalla
 * compartida. Tenerlo duplicado dejaba la pantalla creada por un admin sin fila
 * en 403 nada mas activarla (22-09).
 */
export function permisoDeStretch(
  user: { active: boolean; role: string } | null,
  acceso: { gestionar: boolean; solicitar: boolean } | null,
) {
  if (!user?.active) return { gestionar: false, solicitar: false }
  const admin = user.role === 'ADMIN'
  return { gestionar: admin || !!acceso?.gestionar, solicitar: admin || !!acceso?.solicitar }
}

export async function permisoStretch(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { active: true, role: true } })
  const acceso = user?.active ? await prisma.stretchAcceso.findUnique({ where: { userId } }) : null
  return permisoDeStretch(user, acceso)
}
export async function actorStretch(event: H3Event, gestion = false) {
  const actor = await requireAuth(event), permiso = await permisoStretch(actor.id)
  if (gestion ? !permiso.gestionar : !permiso.gestionar && !permiso.solicitar) throw createError({ statusCode: 403, statusMessage: 'Sin permiso de Stretch film' })
  return { actor, permiso }
}
export async function lockStretch(tx: Prisma.TransactionClient) { await tx.$executeRaw`SELECT pg_advisory_xact_lock(71420919)` }
export async function sesionStretch(event: H3Event, tx: Prisma.TransactionClient) {
  const token = getCookie(event, COOKIE_STRETCH)
  const sesion = token && token.length === 64 ? await tx.stretchSesion.findUnique({ where: { tokenHash: hashStretch(token) } }) : null
  if (!sesion || !sesion.activada || sesion.revocadaAt || sesion.expiraAt <= new Date()) throw createError({ statusCode: 401, statusMessage: 'Sesión compartida vencida. Solicita un nuevo código a Eduardo o Felipe.' })
  // La pantalla vale mientras quien la creo siga pudiendo gestionar: si se le
  // quita el permiso o se le desactiva la cuenta, la tablet deja de pedir.
  const [acceso, u] = await Promise.all([
    tx.stretchAcceso.findUnique({ where: { userId: sesion.creadaPorId } }),
    tx.user.findUnique({ where: { id: sesion.creadaPorId }, select: { active: true, role: true } }),
  ])
  if (!permisoDeStretch(u, acceso).gestionar) throw createError({ statusCode: 403, statusMessage: 'Sesión compartida deshabilitada' })
  return sesion
}
export async function avisarStretch(tx: Prisma.TransactionClient, nombre: string, rollos: number) {
  // Quien gestiona por permiso propio MAS los administradores, que lo tienen por
  // el rol: si no, un admin procesa pedidos que nunca le avisaron.
  const permisos = await tx.stretchAcceso.findMany({ where: { gestionar: true } })
  const users = await tx.user.findMany({
    where: { active: true, OR: [{ id: { in: permisos.map(p => p.userId) } }, { role: 'ADMIN' }] },
    select: { id: true },
  })
  await tx.notificacion.createMany({ data: users.map(u => ({ userId: u.id, titulo: 'Solicitud de Stretch film', descripcion: `${nombre}: ${rollos} rollos`, tipo: 'STRETCH', enlace: '/dashboard/stretch-film' })) })
}
