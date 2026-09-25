import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { CARGUE_INCLUDE, mapCargue, requireCargue } from '../../utils/cargueCamion'
import { diaBogota } from '../../utils/indicadoresCalc'

const RE_DIA = /^\d{4}-\d{2}-\d{2}$/

/**
 * GET /api/cargue-camiones?fecha=YYYY-MM-DD - los camiones del dia y TODOS los
 * que siguen abiertos (un camion puede quedar abierto de un dia para otro).
 * Tambien trae las transportadoras y tipos de vehiculo ya usados, para
 * sugerirlos y que no se escriba la misma de dos formas.
 */
export default defineEventHandler(async (event) => {
  await requireCargue(event)
  const q = getQuery(event)
  const fecha = RE_DIA.test(String(q.fecha ?? '')) ? String(q.fecha) : diaBogota(new Date())
  const dia = new Date(`${fecha}T00:00:00.000Z`)

  const [abiertos, delDia, transportadoras, vehiculos] = await Promise.all([
    prisma.cargueCamion.findMany({
      where: { deletedAt: null, estado: 'EN_CURSO' },
      include: CARGUE_INCLUDE,
      orderBy: { horaInicio: 'asc' },
    }),
    prisma.cargueCamion.findMany({
      where: { deletedAt: null, estado: 'CERRADO', fecha: dia },
      include: CARGUE_INCLUDE,
      orderBy: { horaInicio: 'desc' },
    }),
    prisma.cargueCamion.groupBy({ by: ['transportadora'], where: { deletedAt: null }, _count: { _all: true }, orderBy: { _count: { transportadora: 'desc' } }, take: 40 }),
    prisma.cargueCamion.groupBy({ by: ['tipoVehiculo'], where: { deletedAt: null }, _count: { _all: true }, orderBy: { _count: { tipoVehiculo: 'desc' } }, take: 40 }),
  ])

  return {
    success: true,
    fecha,
    abiertos: abiertos.map(mapCargue),
    cerrados: delDia.map(mapCargue),
    sugerencias: {
      transportadoras: transportadoras.map((t) => t.transportadora),
      vehiculos: vehiculos.map((v) => v.tipoVehiculo),
    },
  }
})
