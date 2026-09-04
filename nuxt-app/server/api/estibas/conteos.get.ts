import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { calcularDuracionMinutos, todayBogota } from '../../utils/exportacionesCalc'
import { assertUsuarioEstibas, whereScopeEstibas } from '../../utils/estibas'

// GET /api/estibas/conteos — KPIs del día, con el mismo alcance que el listado:
// el montacarguista ve sus números, supervisión ve el total.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioEstibas(actor.role)

  const scope = whereScopeEstibas(actor)
  const hoy = todayBogota()

  const [delDia, enCurso] = await Promise.all([
    prisma.estiba.findMany({
      where: { ...scope, deletedAt: null, fecha: hoy } as never,
      select: { cajas: true, cantidadTotal: true, horaInicio: true, horaFinalizacion: true },
    }),
    prisma.estiba.count({ where: { ...scope, deletedAt: null, horaFinalizacion: null } as never }),
  ])

  let cajasHoy = 0
  let unidadesHoy = 0
  let cerradas = 0
  let duracionTotal = 0
  for (const r of delDia) {
    cajasHoy += r.cajas
    unidadesHoy += r.cantidadTotal
    if (r.horaFinalizacion) {
      cerradas += 1
      const min = calcularDuracionMinutos(r.horaInicio, r.horaFinalizacion)
      if (min) duracionTotal += min
    }
  }

  return {
    success: true,
    data: {
      estibasHoy: delDia.length,
      cajasHoy,
      unidadesHoy,
      enCurso,
      promedioMin: cerradas > 0 ? Math.round((duracionTotal / cerradas) * 10) / 10 : null,
    },
  }
})
