import { defineEventHandler, getQuery, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { diaBogota } from '../../utils/indicadoresCalc'
import { indicadoresCargue, resumirCargue, type CamionInd, type IndicadoresCargue, type ResumenCargue } from '../../utils/cargueIndicadoresCalc'

const RE_DIA = /^\d{4}-\d{2}-\d{2}$/
const MS_DIA = 86_400_000
const MAX_DIAS = 366
const ROLES = ['SUPERVISOR_TRANSPORTE', 'GERENTE', 'ADMIN']
const diaMas = (dia: string, n: number) => diaBogota(new Date(new Date(`${dia}T12:00:00-05:00`).getTime() + n * MS_DIA))

export interface RespuestaIndicadoresTransporte extends IndicadoresCargue {
  success: true
  rango: { desde: string; hasta: string }
  anterior: { desde: string; hasta: string; resumen: ResumenCargue }
}

/**
 * GET /api/indicadores-transporte?desde&hasta - indicadores de Cargue de
 * camiones: los camiones finalizados del periodo (por su dia de cargue) y el
 * resumen del periodo anterior del mismo largo, para comparar. Solo gestion.
 */
export default defineEventHandler(async (event): Promise<RespuestaIndicadoresTransporte> => {
  const actor = await requireAuth(event)
  if (!ROLES.includes(actor.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Los indicadores de transporte son para supervision' })
  }
  const q = getQuery(event)
  const hoy = diaBogota(new Date())
  let desde = RE_DIA.test(String(q.desde ?? '')) ? String(q.desde) : hoy
  let hasta = RE_DIA.test(String(q.hasta ?? '')) ? String(q.hasta) : hoy
  if (desde > hasta) [desde, hasta] = [hasta, desde]
  const largo = Math.round((new Date(`${hasta}T12:00:00Z`).getTime() - new Date(`${desde}T12:00:00Z`).getTime()) / MS_DIA) + 1
  if (largo > MAX_DIAS) desde = diaMas(hasta, -(MAX_DIAS - 1))
  const n = Math.min(largo, MAX_DIAS)
  const anterior = { desde: diaMas(desde, -n), hasta: diaMas(desde, -1) }

  const filas = await prisma.cargueCamion.findMany({
    where: {
      deletedAt: null, estado: 'CERRADO',
      fecha: { gte: new Date(`${anterior.desde}T00:00:00.000Z`), lte: new Date(`${hasta}T00:00:00.000Z`) },
    },
    select: {
      id: true, fecha: true, tipoVehiculo: true, transportadora: true, placa: true, horaInicio: true, horaFinalizacion: true,
      otrosOperarios: true,
      operarios: { select: { operario: { select: { nombre: true } } } },
      ordenes: {
        where: { horaFin: { not: null } },
        select: {
          codigo: true, origen: true, tienda: true, cliente: true, ciudad: true, bultosDeclarados: true, bultosCargados: true,
          notaDiferencia: true, m3: true, kg: true, valorOvdm: true, horaInicio: true, horaFin: true,
        },
      },
    },
  })
  const num = (v: unknown) => (v == null ? null : Number(v))
  const camiones: CamionInd[] = filas.map((c) => ({
    id: c.id,
    fecha: c.fecha.toISOString().slice(0, 10),
    tipoVehiculo: c.tipoVehiculo,
    transportadora: c.transportadora,
    placa: c.placa,
    horaInicio: c.horaInicio,
    horaFinalizacion: c.horaFinalizacion,
    operarios: [...c.operarios.map((o) => o.operario.nombre), ...(c.otrosOperarios ?? [])],
    ordenes: c.ordenes.map((o) => ({ ...o, m3: num(o.m3), kg: num(o.kg), valorOvdm: num(o.valorOvdm) })),
  }))
  const enRango = (c: CamionInd, v: { desde: string; hasta: string }) => c.fecha >= v.desde && c.fecha <= v.hasta

  return {
    success: true,
    rango: { desde, hasta },
    anterior: { ...anterior, resumen: resumirCargue(camiones.filter((c) => enRango(c, anterior))) },
    ...indicadoresCargue(camiones.filter((c) => enRango(c, { desde, hasta }))),
  }
})
