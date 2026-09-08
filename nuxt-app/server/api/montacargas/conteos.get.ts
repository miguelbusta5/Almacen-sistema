import { defineEventHandler, getQuery, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { todayBogota } from '../../utils/exportacionesCalc'
import { minutosTrabajados } from '../../utils/montacargasCalc'
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

  const [delDia, enCurso, conNovedad] = await Promise.all([
    prisma.movimientoMontacargas.findMany({
      where: { ...scope, tipo, deletedAt: null, fecha: hoy } as never,
      select: {
        cajas: true, cantidadTotal: true, unidadesSueltas: true, estado: true,
        tramos: { select: { usuarioId: true, inicio: true, fin: true } },
      },
    }),
    prisma.movimientoMontacargas.count({
      where: { ...scope, tipo, deletedAt: null, estado: 'EN_CURSO' } as never,
    }),
    prisma.movimientoMontacargas.count({
      where: { ...scope, tipo, deletedAt: null, estado: 'NOVEDAD' } as never,
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
    if (r.estado === 'CERRADO') {
      cerrados += 1
      // Solo tramos trabajados: la ventana de una novedad no cuenta.
      duracionTotal += minutosTrabajados(r.tramos)
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
      conNovedad,
      promedioMin: cerrados > 0 ? Math.round((duracionTotal / cerrados) * 10) / 10 : null,
    },
  }
})
