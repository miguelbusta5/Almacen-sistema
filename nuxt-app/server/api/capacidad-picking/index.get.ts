import { defineEventHandler } from 'h3'
import { requireAuth } from '../../utils/auth'
import { exigirPicking, informeConMaestro, lineasConMaestro } from '../../utils/picking'
import { prisma } from '../../utils/prisma'
export default defineEventHandler(async event => {
  const actor = await requireAuth(event); await exigirPicking(actor)
  const [informes, capacidades, abierto] = await Promise.all([
    prisma.pickingInforme.findMany({ orderBy: { inicio: 'desc' }, take: 100, include: { lineas: true } }),
    prisma.pickingCapacidad.findMany({ orderBy: { ubicacion: 'asc' } }),
    prisma.pickingInforme.findFirst({ where: { autorId: actor.id, estado: 'ABIERTO' }, include: { lineas: true } }),
  ])
  const lista = abierto && !informes.some(r => r.id === abierto.id) ? [abierto, ...informes] : informes
  // Descripcion, unidad de empaque y unidades totales del maestro vigente.
  return {
    informes: await Promise.all(lista.map(r => informeConMaestro(prisma, r))),
    capacidades: await lineasConMaestro(prisma, capacidades),
  }
})
