import { createError, defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { puedeMontarResurtido } from '../../utils/resurtido'
import { diaBogota, limitesRango, resumenPausas } from '../../utils/indicadoresCalc'

const RE_DIA = /^\d{4}-\d{2}-\d{2}$/

/**
 * Quien puede ver el registro de pausas: el administrador y quien reparte el
 * trabajo del CEDI (permiso por persona de montar resurtido: Felipe Ossa y
 * Eduardo Zurita). No es informacion para el resto de supervision.
 */
async function puedeVerPausas(actor: { id: string; role: string }): Promise<boolean> {
  return actor.role === 'ADMIN' || (await puedeMontarResurtido(actor.id))
}

/**
 * GET /api/indicadores/pausas?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 *
 * Cuantas veces y cuanto tiempo usa cada persona los botones de pausa
 * (alimentacion y cambio de baterias). Una pausa cuenta en el dia en que empieza.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  if (!(await puedeVerPausas(actor))) {
    throw createError({ statusCode: 403, statusMessage: 'El registro de pausas es solo para administracion' })
  }

  const sp = getQuery(event)
  const hoy = diaBogota(new Date())
  let desde = RE_DIA.test(String(sp.desde ?? '')) ? String(sp.desde) : hoy
  let hasta = RE_DIA.test(String(sp.hasta ?? '')) ? String(sp.hasta) : hoy
  if (desde > hasta) [desde, hasta] = [hasta, desde]
  const { inicio, fin } = limitesRango(desde, hasta)

  const pausas = await prisma.pausaOperativa.findMany({
    where: { inicio: { gte: inicio, lte: fin } },
    select: { id: true, usuarioId: true, motivo: true, inicio: true, fin: true },
    orderBy: { inicio: 'desc' },
  })
  const usuarios = await prisma.user.findMany({
    where: { id: { in: [...new Set(pausas.map((p) => p.usuarioId))] } },
    select: { id: true, name: true, role: true },
  })

  return {
    success: true,
    rango: { desde, hasta },
    data: resumenPausas({
      personas: usuarios.map((u) => ({ id: u.id, nombre: u.name, rol: u.role })),
      pausas,
      ahora: new Date(),
    }),
  }
})
