import { createError } from 'h3'
import type { Prisma } from '@prisma/client'
import type { SessionUser } from './auth'
import { permisosInventarios } from './inventarios'
import { resolverPluMaestro } from './codigoProducto'
import type { FilaInventario } from './inventarioCiclicoCalc'

export async function actorInventario(actor: SessionUser, gestion = false) {
  const p = await permisosInventarios(actor.id)
  if (gestion ? !p.gestionar : !p.gestionar && !p.contar) throw createError({ statusCode: 403, statusMessage: 'Sin permiso de inventarios' })
  return p
}
export async function lockInventario(tx: Prisma.TransactionClient) { await tx.$executeRaw`SELECT pg_advisory_xact_lock(71420918)` }
export async function productoInventario(tx: Prisma.TransactionClient, cronogramaId: string, codigo: string) {
  const v = await tx.inventarioMaestroVersion.findFirst({ where: { cronogramaId }, orderBy: { numero: 'desc' }, select: { id: true } })
  if (!v) throw createError({ statusCode: 409, statusMessage: 'El cronograma no tiene maestro PVP' })
  const matches = await tx.inventarioProductoPvp.findMany({ where: { versionId: v.id, OR: [{ plu: codigo }, { upc: codigo }] }, take: 2 })
  if (matches.length > 1) throw createError({ statusCode: 409, statusMessage: 'Código compartido por varios PLU. Carlos debe revisar el maestro' })
  if (matches[0]) return matches[0]
  const plu = await resolverPluMaestro(codigo, tx)
  return tx.inventarioProductoPvp.findUnique({ where: { versionId_plu: { versionId: v.id, plu } } })
}
export const filasInventario = (value: Prisma.JsonValue) => value as unknown as FilaInventario[]
export async function auditarInventario(tx: Prisma.TransactionClient, actor: SessionUser, id: string, details: string) {
  await tx.activityLog.create({ data: { userId: actor.id, action: 'UPDATE', module: 'inventarios', recordId: id, details } })
}
