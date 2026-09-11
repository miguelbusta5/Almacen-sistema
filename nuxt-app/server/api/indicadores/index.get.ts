import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { assertGestorMontacargas } from '../../utils/montacargas'
import {
  agregarIndicadores, diaBogota, limitesRango,
  type TiempoRegistrado, type TipoTarea, type UnidadesRegistradas,
} from '../../utils/indicadoresCalc'

// A quien se mide: los que mueven la mercancia.
const MEDIDOS = ['MONTACARGAS', 'OPERARIO_ALMACENAMIENTO'] as const

const RE_DIA = /^\d{4}-\d{2}-\d{2}$/

const TIPO_MOVIMIENTO: Record<string, TipoTarea> = {
  RECEPCION: 'recepcion',
  MOVIMIENTO: 'movimiento',
  RESURTIDO: 'resurtido',
}

/**
 * GET /api/indicadores?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&rol=&usuarioId=
 *
 * Tiempo laborado de montacarguistas y operarios, sacado de las cinco tomas de
 * tiempo del CEDI: recepcion, movimientos y resurtido (Control Montacargas), las
 * tareas de resurtido por archivo, los pendientes y la recepcion de contenedores.
 *
 * Este endpoint solo junta las filas; la cuenta esta en agregarIndicadores. El
 * tiempo de cada persona es RELOJ DE PARED con al menos un PLU en la mano, no la
 * suma de sus relojes: sumarlos contaba el mismo minuto varias veces cuando
 * llevaba varios PLUs a la vez.
 */
export default defineEventHandler(async (event) => {
  // Solo gestion: son los numeros con los que se evalua al equipo, no
  // informacion operativa del turno.
  const actor = await requireAuth(event)
  assertGestorMontacargas(actor.role, 'Los indicadores son para supervision')

  const sp = getQuery(event)
  const hoy = diaBogota(new Date())
  let desde = RE_DIA.test(String(sp.desde ?? '')) ? String(sp.desde) : hoy
  let hasta = RE_DIA.test(String(sp.hasta ?? '')) ? String(sp.hasta) : hoy
  if (desde > hasta) [desde, hasta] = [hasta, desde]
  const rol = (MEDIDOS as readonly string[]).includes(String(sp.rol ?? '')) ? String(sp.rol) : null
  const usuarioId = sp.usuarioId ? String(sp.usuarioId) : null
  const { inicio: ini, fin } = limitesRango(desde, hasta)

  // La lista completa sirve al selector de persona aunque se filtre por una. Sin
  // filtrar por activos: quien ya no esta sigue teniendo su historia.
  const equipo = await prisma.user.findMany({
    where: { role: { in: [...MEDIDOS] } },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  })
  const personas = equipo
    .filter((u) => (!rol || u.role === rol) && (!usuarioId || u.id === usuarioId))
    .map((u) => ({ id: u.id, nombre: u.name, rol: u.role }))

  const tiempos: TiempoRegistrado[] = []
  const unidades: UnidadesRegistradas[] = []

  const [tramos, cerrados, tareas, pendientes, recepciones] = await Promise.all([
    // 1. Control Montacargas: recepcion, movimientos y resurtido. Un tramo por
    // cada persona que tuvo el PLU en la mano.
    prisma.tramoMontacargas.findMany({
      where: { fin: { not: null, gt: ini }, inicio: { lt: fin }, movimiento: { deletedAt: null } },
      select: {
        usuarioId: true, inicio: true, fin: true, movimientoId: true,
        movimiento: { select: { tipo: true } },
      },
    }),
    // Las unidades son de quien UBICO la mercancia: el responsable al cerrar.
    prisma.movimientoMontacargas.findMany({
      where: { deletedAt: null, estado: 'CERRADO', horaFinalizacion: { gte: ini, lte: fin } },
      select: { responsableId: true, cantidadTotal: true, horaFinalizacion: true },
    }),
    // 2. Tareas de resurtido por archivo. Sin las de montajes borrados: hay mas
    // de mil de pruebas que ensuciarian todo.
    prisma.tareaResurtido.findMany({
      where: {
        estado: 'COMPLETADA',
        horaInicio: { not: null, lt: fin },
        horaFin: { not: null, gt: ini },
        montaje: { deletedAt: null },
      },
      select: {
        id: true, horaInicio: true, horaFin: true, unidadesBajadas: true,
        montaje: { select: { operarioId: true } },
      },
    }),
    // 3. Pendientes. Los que se sumaron a una tarea de resurtido no cuentan
    // aparte: su tiempo y sus unidades ya estan en esa tarea.
    prisma.pendienteGourmet.findMany({
      where: {
        deletedAt: null,
        estado: 'COMPLETADO',
        tareaResurtidoId: null,
        horaInicio: { not: null, lt: fin },
        horaFin: { not: null, gt: ini },
      },
      select: { id: true, operarioId: true, horaInicio: true, horaFin: true, unidadesBajadas: true },
    }),
    // 4. Recepcion de contenedores: trabaja quien lleva la planilla Y cada
    // persona descargando, porque la descarga la hacen todos ellos.
    prisma.recepcionContenedor.findMany({
      where: {
        deletedAt: null,
        estado: 'CERRADO',
        horaInicio: { lt: fin },
        horaFinalizacion: { not: null, gt: ini },
      },
      select: {
        creadoPorId: true, horaInicio: true, horaFinalizacion: true,
        descargadores: { select: { usuarioId: true } },
      },
    }),
  ])

  for (const t of tramos) {
    const tipo = TIPO_MOVIMIENTO[t.movimiento.tipo]
    if (!tipo || !t.fin) continue
    tiempos.push({ usuarioId: t.usuarioId, inicio: t.inicio, fin: t.fin, tipo, registro: `m:${t.movimientoId}` })
  }
  for (const m of cerrados) {
    if (m.horaFinalizacion) {
      unidades.push({ usuarioId: m.responsableId, cuando: m.horaFinalizacion, unidades: m.cantidadTotal })
    }
  }
  for (const t of tareas) {
    if (!t.horaInicio || !t.horaFin) continue
    const uid = t.montaje.operarioId
    tiempos.push({ usuarioId: uid, inicio: t.horaInicio, fin: t.horaFin, tipo: 'resurtido', registro: `t:${t.id}` })
    unidades.push({ usuarioId: uid, cuando: t.horaFin, unidades: t.unidadesBajadas ?? 0 })
  }
  for (const p of pendientes) {
    if (!p.operarioId || !p.horaInicio || !p.horaFin) continue
    tiempos.push({ usuarioId: p.operarioId, inicio: p.horaInicio, fin: p.horaFin, tipo: 'pendiente', registro: `p:${p.id}` })
    unidades.push({ usuarioId: p.operarioId, cuando: p.horaFin, unidades: p.unidadesBajadas ?? 0 })
  }
  // Un contenedor no es un PLU: su tiempo cuenta, pero no entra en el promedio
  // por PLU ni en und/hora (registro null).
  for (const r of recepciones) {
    if (!r.horaFinalizacion) continue
    for (const uid of new Set([r.creadoPorId, ...r.descargadores.map((d) => d.usuarioId)])) {
      tiempos.push({ usuarioId: uid, inicio: r.horaInicio, fin: r.horaFinalizacion, tipo: 'contenedor', registro: null })
    }
  }

  return {
    success: true,
    rango: { desde, hasta },
    equipo: equipo.map((u) => ({ id: u.id, nombre: u.name, rol: u.role })),
    data: agregarIndicadores({ personas, tiempos, unidades, desde, hasta }),
  }
})
