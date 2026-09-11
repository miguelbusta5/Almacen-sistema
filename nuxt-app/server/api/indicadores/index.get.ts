import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { assertGestorMontacargas } from '../../utils/montacargas'
import {
  agregarIndicadores, agregarTiemposMuertos, diaBogota, esMotivoTiempoMuerto, finDelDiaBogota,
  limitesRango,
  type JustificacionTiempoMuerto, type TiempoRegistrado, type TipoTarea, type UnidadesRegistradas,
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
 *
 * Devuelve tambien los tiempos muertos (agregarTiemposMuertos): los ratos sin
 * nada en la mano, con lo que ya justificaron los supervisores.
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
  // Lo que sigue en curso: no es tiempo laborado todavia (entra al cerrarse),
  // pero una persona con un PLU abierto esta trabajando, no parada. Solo sirve
  // para no inventar tiempos muertos.
  const enCurso: TiempoRegistrado[] = []
  const ahora = new Date()
  // Un reloj abierto cuenta hasta ahora, y como mucho hasta el final del dia en
  // que empezo: uno olvidado desde ayer no puede tapar los huecos de hoy.
  const finAbierto = (inicio: Date) => new Date(Math.min(ahora.getTime(), finDelDiaBogota(inicio).getTime()))

  const [tramos, cerrados, tareas, pendientes, recepciones, justificadas] = await Promise.all([
    // 1. Control Montacargas: recepcion, movimientos y resurtido. Un tramo por
    // cada persona que tuvo el PLU en la mano.
    prisma.tramoMontacargas.findMany({
      where: {
        OR: [{ fin: { gt: ini } }, { fin: null }],
        inicio: { lt: fin },
        movimiento: { deletedAt: null },
      },
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
        horaInicio: { not: null, lt: fin },
        OR: [
          { estado: 'COMPLETADA', horaFin: { not: null, gt: ini } },
          { estado: 'EN_CURSO', horaFin: null },
        ],
        montaje: { deletedAt: null },
      },
      select: {
        id: true, estado: true, horaInicio: true, horaFin: true, unidadesBajadas: true,
        montaje: { select: { operarioId: true } },
      },
    }),
    // 3. Pendientes. Los que se sumaron a una tarea de resurtido no cuentan
    // aparte: su tiempo y sus unidades ya estan en esa tarea.
    prisma.pendienteGourmet.findMany({
      where: {
        deletedAt: null,
        tareaResurtidoId: null,
        horaInicio: { not: null, lt: fin },
        OR: [
          { estado: 'COMPLETADO', horaFin: { not: null, gt: ini } },
          { estado: 'EN_CURSO', horaFin: null },
        ],
      },
      select: {
        id: true, estado: true, operarioId: true, horaInicio: true, horaFin: true, unidadesBajadas: true,
        // Tiempo por persona: quien lo empezo y el ayudante que lo cerro.
        tramos: { select: { usuarioId: true, inicio: true, fin: true } },
      },
    }),
    // 4. Recepcion de contenedores: trabaja quien lleva la planilla Y cada
    // persona descargando, porque la descarga la hacen todos ellos.
    prisma.recepcionContenedor.findMany({
      where: {
        deletedAt: null,
        horaInicio: { lt: fin },
        OR: [
          { estado: 'CERRADO', horaFinalizacion: { not: null, gt: ini } },
          { estado: 'EN_CURSO', horaFinalizacion: null },
        ],
      },
      select: {
        estado: true, creadoPorId: true, horaInicio: true, horaFinalizacion: true,
        descargadores: { select: { usuarioId: true } },
      },
    }),
    // 5. Lo que ya justificaron los supervisores sobre los tiempos muertos.
    prisma.justificacionTiempoMuerto.findMany({
      where: {
        deletedAt: null,
        usuarioId: { in: personas.map((p) => p.id) },
        inicio: { lt: fin },
        fin: { gt: ini },
      },
      select: {
        id: true, usuarioId: true, inicio: true, fin: true, motivo: true, observacion: true,
        createdAt: true, justificadoPor: { select: { name: true } },
      },
    }),
  ])

  for (const t of tramos) {
    const tipo = TIPO_MOVIMIENTO[t.movimiento.tipo]
    if (!tipo) continue
    const registro = `m:${t.movimientoId}`
    if (t.fin) tiempos.push({ usuarioId: t.usuarioId, inicio: t.inicio, fin: t.fin, tipo, registro })
    else enCurso.push({ usuarioId: t.usuarioId, inicio: t.inicio, fin: finAbierto(t.inicio), tipo, registro })
  }
  for (const m of cerrados) {
    if (m.horaFinalizacion) {
      unidades.push({ usuarioId: m.responsableId, cuando: m.horaFinalizacion, unidades: m.cantidadTotal })
    }
  }
  for (const t of tareas) {
    if (!t.horaInicio) continue
    const uid = t.montaje.operarioId
    const registro = `t:${t.id}`
    if (t.estado !== 'COMPLETADA' || !t.horaFin) {
      enCurso.push({ usuarioId: uid, inicio: t.horaInicio, fin: finAbierto(t.horaInicio), tipo: 'resurtido', registro })
      continue
    }
    tiempos.push({ usuarioId: uid, inicio: t.horaInicio, fin: t.horaFin, tipo: 'resurtido', registro })
    unidades.push({ usuarioId: uid, cuando: t.horaFin, unidades: t.unidadesBajadas ?? 0 })
  }
  for (const p of pendientes) {
    if (!p.operarioId || !p.horaInicio) continue
    const registro = `p:${p.id}`
    const cerrado = p.estado === 'COMPLETADO' && p.horaFin
    // Con tramos (desde que se pueden pasar con el reloj corriendo), cada persona
    // su parte. Los de antes no tienen tramos: todo es de quien lo ubico.
    const tramos = p.tramos.length > 0
      ? p.tramos
      : [{ usuarioId: p.operarioId, inicio: p.horaInicio, fin: p.horaFin }]
    for (const t of tramos) {
      const base = { usuarioId: t.usuarioId, inicio: t.inicio, tipo: 'pendiente' as const, registro }
      if (cerrado && t.fin) tiempos.push({ ...base, fin: t.fin })
      else enCurso.push({ ...base, fin: t.fin ?? finAbierto(t.inicio) })
    }
    // Las unidades son de quien lo ubico.
    if (cerrado) unidades.push({ usuarioId: p.operarioId, cuando: p.horaFin!, unidades: p.unidadesBajadas ?? 0 })
  }
  // Un contenedor no es un PLU: su tiempo cuenta, pero no entra en el promedio
  // por PLU ni en und/hora (registro null).
  for (const r of recepciones) {
    const finCierre = r.estado === 'CERRADO' ? r.horaFinalizacion : null
    for (const uid of new Set([r.creadoPorId, ...r.descargadores.map((d) => d.usuarioId)])) {
      const base = { usuarioId: uid, inicio: r.horaInicio, tipo: 'contenedor' as const, registro: null }
      if (finCierre) tiempos.push({ ...base, fin: finCierre })
      else enCurso.push({ ...base, fin: finAbierto(r.horaInicio) })
    }
  }

  const justificaciones: JustificacionTiempoMuerto[] = justificadas.flatMap((j) =>
    esMotivoTiempoMuerto(j.motivo)
      ? [{
        id: j.id,
        usuarioId: j.usuarioId,
        inicio: j.inicio,
        fin: j.fin,
        motivo: j.motivo,
        observacion: j.observacion,
        justificadoPor: j.justificadoPor.name,
        justificadoAt: j.createdAt,
      }]
      : [])

  return {
    success: true,
    rango: { desde, hasta },
    equipo: equipo.map((u) => ({ id: u.id, nombre: u.name, rol: u.role })),
    data: agregarIndicadores({ personas, tiempos, unidades, desde, hasta }),
    muertos: agregarTiemposMuertos({
      personas, tiempos: [...tiempos, ...enCurso], justificaciones, desde, hasta,
    }),
  }
})
