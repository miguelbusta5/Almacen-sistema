import { defineEventHandler, getQuery, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { calcularDuracionMinutos, todayBogota } from '../../utils/exportacionesCalc'
import { assertUsuarioMontacargas, whereScopeMontacargas } from '../../utils/montacargas'
import { esTipoMovimiento } from '../../utils/montacargasCalc'

// GET /api/montacargas/conteos?tipo=... - KPIs del dia, con el mismo alcance que
// el listado: el montacarguista ve sus numeros, supervision ve el total.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioMontacargas(actor.role)

  const tipo = String(getQuery(event).tipo ?? '').trim()
  if (!esTipoMovimiento(tipo)) {
    throw createError({ statusCode: 400, statusMessage: 'Tipo de registro invalido' })
  }

  const scope = whereScopeMontacargas(actor)
  const hoy = todayBogota()

  const [delDia, enCurso] = await Promise.all([
    prisma.movimientoMontacargas.findMany({
      where: { ...scope, tipo, deletedAt: null, fecha: hoy } as never,
      select: {
        cajas: true, cantidadTotal: true, unidadesSueltas: true,
        horaInicio: true, horaFinalizacion: true,
      },
    }),
    prisma.movimientoMontacargas.count({
      where: { ...scope, tipo, deletedAt: null, horaFinalizacion: null } as never,
    }),
  ])

  let cajasHoy = 0
  let unidadesHoy = 0
  let sueltasHoy = 0
  let cerrados = 0
  let duracionTotal = 0
  for (const r of delDia) {
    cajasHoy += r.cajas
    unidadesHoy += r.cantidadTotal
    sueltasHoy += r.unidadesSueltas
    if (r.horaFinalizacion) {
      cerrados += 1
      const min = calcularDuracionMinutos(r.horaInicio, r.horaFinalizacion)
      if (min) duracionTotal += min
    }
  }

  return {
    success: true,
    data: {
      registrosHoy: delDia.length,
      cajasHoy,
      unidadesHoy,
      sueltasHoy,
      enCurso,
      promedioMin: cerrados > 0 ? Math.round((duracionTotal / cerrados) * 10) / 10 : null,
    },
  }
})
