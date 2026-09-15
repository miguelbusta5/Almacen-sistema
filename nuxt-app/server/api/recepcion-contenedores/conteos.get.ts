import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { assertUsuarioRecepcion, whereScopeRecepcion } from '../../utils/recepcion'
import { segundosRecepcion } from '../../utils/recepcionCalc'
import { todayBogota } from '../../utils/exportacionesCalc'

// GET /api/recepcion-contenedores/conteos - KPIs del dia.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioRecepcion(actor.role)

  const hoy = todayBogota(new Date())
  const scope = whereScopeRecepcion(actor)

  const delDia = await prisma.recepcionContenedor.findMany({
    where: { ...scope, deletedAt: null, fecha: hoy },
    select: {
      estado: true, cajas: true, unidades: true, estibasUsadas: true,
      horaInicio: true, horaFinalizacion: true, pausaSegundos: true,
      _count: { select: { novedades: true } },
    },
  })

  let cajasHoy = 0
  let unidadesHoy = 0
  let estibasHoy = 0
  let enCurso = 0
  let conNovedad = 0
  let cerradas = 0
  // En segundos: acumular minutos ya redondeados pierde las descargas cortas.
  let duracionTotal = 0

  for (const r of delDia) {
    cajasHoy += r.cajas
    unidadesHoy += r.unidades
    estibasHoy += r.estibasUsadas ?? 0
    if (r.estado === 'EN_CURSO') enCurso += 1
    if (r._count.novedades > 0) conNovedad += 1
    if (r.estado === 'CERRADO') {
      cerradas += 1
      duracionTotal += Math.max(0, (segundosRecepcion(r.horaInicio, r.horaFinalizacion) ?? 0) - r.pausaSegundos)
    }
  }

  return {
    success: true,
    data: {
      recepcionesHoy: delDia.length,
      enCurso,
      unidadesHoy,
      cajasHoy,
      estibasHoy,
      conNovedad,
      promedioSeg: cerradas > 0 ? Math.round(duracionTotal / cerradas) : null,
    },
  }
})
