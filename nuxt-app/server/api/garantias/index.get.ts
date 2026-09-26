import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { esGestor, ROLES_GARANTIAS, INCLUDE_GARANTIA, mapGarantia } from '../../utils/garantias'

export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, ROLES_GARANTIAS)
  const gestor = esGestor(actor.role)
  const historico = getQuery(event).historico === '1'
  const tareas = await prisma.tareaGarantia.findMany({
    where: {
      ...(gestor ? {} : { usuarioId: actor.id }),
      ...(historico ? {} : { horaFin: null }),
    },
    include: INCLUDE_GARANTIA,
    orderBy: { horaInicio: 'desc' },
    take: historico ? 150 : 100,
  })
  return { data: tareas.map((t) => mapGarantia(t, gestor)), gestor }
})
