import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { mapTareaGeneral, TAREA_GENERAL_INCLUDE } from '../../utils/tareasGenerales'
import { puedeMandarTarea, puedeVerTareas } from '../../utils/tareasGeneralesCalc'

/**
 * GET /api/tareas-generales - las tareas en curso (historico=1 trae tambien las
 * terminadas de los ultimos dias).
 *
 * Supervision y gerencia ven todas; el operario ve SOLO las suyas, que es lo que
 * necesita para saber que le mandaron.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  const verTodas = puedeVerTareas(actor.role)
  const historico = String(getQuery(event).historico ?? '') === '1'

  const tareas = await prisma.tareaGeneral.findMany({
    where: {
      ...(historico ? {} : { estado: 'EN_CURSO' }),
      ...(verTodas ? {} : { asignados: { some: { usuarioId: actor.id } } }),
    },
    include: TAREA_GENERAL_INCLUDE,
    orderBy: { horaInicio: 'desc' },
    take: historico ? 100 : 50,
  })

  // Gerencia ve todo pero no manda: la pantalla esconde los botones y el
  // servidor lo vuelve a exigir en cada escritura.
  return { success: true, data: tareas.map(mapTareaGeneral), puedeMandar: puedeMandarTarea(actor.role) }
})
