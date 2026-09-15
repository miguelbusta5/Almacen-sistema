import { createError } from 'h3'
import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'
import { calcularPicking, unidadesCapacidad, type PickingFila, type PickingValidacion } from './pickingCalc'
import { assertPuedeMontar, assertVeMontaje } from './resurtido'
import type { SessionUser } from './auth'

export async function accesoPicking(id: string) {
  const [permiso, usuario] = await Promise.all([
    prisma.pickingAcceso.findUnique({ where: { userId: id } }),
    prisma.user.findUnique({ where: { id }, select: { active: true } }),
  ])
  return !!permiso?.activo && !!usuario?.active
}
// Descripcion y unidad de empaque SIEMPRE del maestro vigente: no se guardan en
// el informe. Asi las tablas dicen lo mismo que usara el calculo del resurtido,
// y corregir el maestro se ve en todas partes sin tocar informes.
type DbMaestro = Pick<Prisma.TransactionClient, 'productoMaestro'>
export interface DatoMaestro { descripcion: string | null; unidadesPorCaja: number | null }
export async function datosMaestro(db: DbMaestro, plus: readonly string[]): Promise<Map<string, DatoMaestro>> {
  const unicos = [...new Set(plus)]
  if (!unicos.length) return new Map()
  const productos = await db.productoMaestro.findMany({ where: { plu: { in: unicos } }, select: { plu: true, descripcion: true, unidadesPorCaja: true } })
  return new Map(productos.map(p => [p.plu, { descripcion: p.descripcion ?? null, unidadesPorCaja: p.unidadesPorCaja && p.unidadesPorCaja > 0 ? p.unidadesPorCaja : null }]))
}
export async function lineasConMaestro<T extends { plu: string; cajas: number }>(db: DbMaestro, lineas: readonly T[]) {
  const maestro = await datosMaestro(db, lineas.map(l => l.plu))
  return lineas.map(l => {
    const m = maestro.get(l.plu)
    const unidadesPorCaja = m?.unidadesPorCaja ?? null
    return { ...l, descripcion: m?.descripcion ?? null, unidadesPorCaja, unidades: unidadesCapacidad(l.cajas, unidadesPorCaja) }
  })
}
export async function informeConMaestro<T extends { lineas: { plu: string; cajas: number }[] }>(db: DbMaestro, informe: T) {
  return { ...informe, lineas: await lineasConMaestro(db, informe.lineas) }
}
export async function exigirPicking(actor: SessionUser) {
  if (!await accesoPicking(actor.id)) throw createError({ statusCode: 403, statusMessage: 'Sin permiso individual para Capacidad picking' })
}
export async function exigirTeorico(actor: SessionUser) {
  assertVeMontaje(actor.role)
  await assertPuedeMontar(actor.id)
}
// Compartido con las operaciones de almacén: serializa generación, pendientes,
// pausas y los montajes manuales entre todas las instancias del servidor.
export async function bloquearPicking(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(71420914)`
}
// PLU con trabajo abierto. Los pendientes solo cuentan para el calculo por
// capacidad, y solo los que estan vivos (pedido, asignado o en curso): uno
// DEVUELTO o en NOVEDAD no es trabajo en marcha y bloquearia el PLU sin fin. El
// montaje por archivo no los mira, porque un pendiente de un PLU que viene en el
// resurtido se SUMA a esa tarea (pendientes/[id]/asignar.post.ts).
export async function plusOcupados(tx: Prisma.TransactionClient, plus: string[], opciones: { conPendientes?: boolean } = {}) {
  const conPendientes = opciones.conPendientes ?? true
  const [tareas, pendientes] = await Promise.all([
    tx.tareaResurtido.findMany({ where: { plu: { in: plus }, estado: { in: ['PENDIENTE', 'EN_CURSO'] }, montaje: { deletedAt: null } }, select: { plu: true } }),
    conPendientes
      ? tx.pendienteGourmet.findMany({ where: { plu: { in: plus }, deletedAt: null, estado: { in: ['SOLICITADO', 'ASIGNADO', 'EN_CURSO'] } }, select: { plu: true } })
      : Promise.resolve([] as { plu: string }[]),
  ])
  return new Set([...tareas, ...pendientes].map(t => t.plu))
}
export async function previewPicking(tx: Prisma.TransactionClient, id: string) {
  const carga = await tx.pickingTeorico.findUnique({ where: { id } })
  if (!carga) throw createError({ statusCode: 404, statusMessage: 'Teórico no encontrado' })
  const capacidades = await tx.pickingCapacidad.findMany({ orderBy: { ubicacion: 'asc' } })
  const plus = capacidades.map(c => c.plu)
  const productos = await tx.productoMaestro.findMany({ where: { plu: { in: plus } }, select: { plu: true, unidadesPorCaja: true, descripcion: true } })
  const maestro = new Map(productos.map(p => [p.plu, p]))
  const filas = calcularPicking(capacidades.map(c => ({ ...c, unidadesPorCaja: maestro.get(c.plu)?.unidadesPorCaja ?? 0, descripcion: maestro.get(c.plu)?.descripcion ?? c.plu })), carga.filas as unknown as PickingFila[], await plusOcupados(tx, plus), carga.validaciones as unknown as Record<string, PickingValidacion>)
  return { carga: { id: carga.id, nombre: carga.nombre, creadoAt: carga.creadoAt, montajeId: carga.montajeId }, filas }
}
