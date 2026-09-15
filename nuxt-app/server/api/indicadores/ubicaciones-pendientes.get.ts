import { createError, defineEventHandler, getQuery } from 'h3'
import { Prisma } from '@prisma/client'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { puedeMontarResurtido } from '../../utils/resurtido'
import { diaBogota, limitesRango } from '../../utils/indicadoresCalc'
import { desvioSugerencia, type SugerenciaPendiente } from '../../utils/sugerenciaPendienteCalc'

const RE_DIA = /^\d{4}-\d{2}-\d{2}$/

/**
 * GET /api/indicadores/ubicaciones-pendientes?desde&hasta
 *
 * Pendientes en los que el operario NO uso la altura o el picking sugeridos.
 * Solo lo ven el administrador y quien reparte el trabajo (permiso de montar
 * resurtido: Felipe Ossa y Eduardo Zurita). Cuenta en el dia en que se empezo.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  if (!(actor.role === 'ADMIN' || (await puedeMontarResurtido(actor.id)))) {
    throw createError({ statusCode: 403, statusMessage: 'Este registro es solo para administracion' })
  }
  const sp = getQuery(event)
  const hoy = diaBogota(new Date())
  let desde = RE_DIA.test(String(sp.desde ?? '')) ? String(sp.desde) : hoy
  let hasta = RE_DIA.test(String(sp.hasta ?? '')) ? String(sp.hasta) : hoy
  if (desde > hasta) [desde, hasta] = [hasta, desde]
  const { inicio, fin } = limitesRango(desde, hasta)

  const pendientes = await prisma.pendienteGourmet.findMany({
    where: { deletedAt: null, sugerencia: { not: Prisma.DbNull }, horaInicio: { gte: inicio, lte: fin } },
    select: {
      id: true, plu: true, descripcion: true, estado: true, sugerencia: true,
      ubicacionInicial: true, ubicacionFinal: true, horaInicio: true, horaFin: true, operarioId: true,
      operario: { select: { name: true } },
      tramos: { orderBy: { orden: 'asc' }, take: 1, select: { usuarioId: true, usuario: { select: { name: true } } } },
    },
    orderBy: { horaInicio: 'desc' },
  })

  const filas = pendientes.flatMap((p) => {
    const s = p.sugerencia as unknown as SugerenciaPendiente
    const d = desvioSugerencia(s, p.ubicacionInicial, p.ubicacionFinal)
    if (!d.altura && !d.picking) return []
    const inicio = p.tramos[0]
    return [{
      id: p.id, plu: p.plu, descripcion: p.descripcion, estado: p.estado,
      horaInicio: p.horaInicio?.toISOString() ?? null,
      // Quien escaneo la altura y quien ubico en el picking (pueden ser distintos si se paso a un ayudante).
      inicioPorId: inicio?.usuarioId ?? p.operarioId, inicioPorNombre: inicio?.usuario.name ?? p.operario?.name ?? null,
      cierrePorId: p.horaFin ? p.operarioId : null, cierrePorNombre: p.horaFin ? p.operario?.name ?? null : null,
      alturaSugerida: s.alturas.map((a) => a.ubicacion).join(' + ') || null,
      alturaUsada: p.ubicacionInicial, desvioAltura: d.altura === true,
      pickingSugerido: s.picking, pickingUsado: p.ubicacionFinal, desvioPicking: d.picking === true,
    }]
  })
  return { success: true, rango: { desde, hasta }, data: filas }
})
