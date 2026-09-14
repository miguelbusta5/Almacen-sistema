import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { assertGestorMontacargas } from '../../utils/montacargas'
import {
  agregarIndicadores, agregarTiemposMuertos, diaBogota, diasDelRango, esMotivoTiempoMuerto,
  finDelDiaBogota, limitesRango,
  type JustificacionTiempoMuerto, type TiempoRegistrado, type TipoTarea, type UnidadesRegistradas,
  type VentanaTurno,
} from '../../utils/indicadoresCalc'
import { ventanaTurno } from '../../utils/turnosCalc'

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
 *
 * Si hay cuadro de turnos cargado para esas fechas, cada persona lleva ademas
 * su jornada y su efectividad, y los tiempos muertos van acotados al turno (asi
 * entra lo de antes del primer PLU y lo de despues del ultimo).
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
  // Los turnos de noche pasan de la medianoche: el del ultimo dia se trae con
  // su madrugada, y se mira el turno de la noche ANTERIOR al primer dia para
  // dejarle la suya (la cuenta la hace agregarIndicadores, por turnos).
  const finConsulta = new Date(fin.getTime() + 24 * 60 * 60 * 1000)
  const diaAnterior = diaBogota(new Date(new Date(`${desde}T12:00:00-05:00`).getTime() - 24 * 60 * 60 * 1000))

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
  // que empezo (o de su turno, si es de noche y pasa la medianoche): uno
  // olvidado desde ayer no puede tapar los huecos de hoy.
  const ventanas: VentanaTurno[] = []
  const finAbierto = (inicio: Date, usuario: string) => {
    const turno = ventanas.find(
      (v) => v.usuarioId === usuario && v.inicio.getTime() <= inicio.getTime() && inicio.getTime() < v.fin.getTime(),
    )
    const tope = Math.max(finDelDiaBogota(inicio).getTime(), turno?.fin.getTime() ?? 0)
    return new Date(Math.min(ahora.getTime(), tope))
  }

  const [tramos, cerrados, tareas, pendientes, recepciones, cuadros, justificadas] = await Promise.all([
    // 1. Control Montacargas: recepcion, movimientos y resurtido. Un tramo por
    // cada persona que tuvo el PLU en la mano.
    prisma.tramoMontacargas.findMany({
      where: {
        OR: [{ fin: { gt: ini } }, { fin: null }],
        inicio: { lt: finConsulta },
        movimiento: { deletedAt: null },
      },
      select: {
        usuarioId: true, inicio: true, fin: true, movimientoId: true,
        movimiento: { select: { tipo: true } },
      },
    }),
    // Las unidades son de quien UBICO la mercancia: el responsable al cerrar.
    prisma.movimientoMontacargas.findMany({
      where: { deletedAt: null, estado: 'CERRADO', horaFinalizacion: { gte: ini, lte: finConsulta } },
      select: { responsableId: true, cantidadTotal: true, horaFinalizacion: true },
    }),
    // 2. Tareas de resurtido por archivo. Sin las de montajes borrados: hay mas
    // de mil de pruebas que ensuciarian todo.
    prisma.tareaResurtido.findMany({
      where: {
        horaInicio: { not: null, lt: finConsulta },
        OR: [
          { estado: 'COMPLETADA', horaFin: { not: null, gt: ini } },
          { estado: 'EN_CURSO', horaFin: null },
        ],
        montaje: { deletedAt: null },
      },
      select: {
        id: true, estado: true, horaInicio: true, horaFin: true, unidadesBajadas: true, responsableId: true,
        montaje: { select: { operarioId: true } },
        // Tiempo por persona: quien la empezo y el ayudante que la cerro.
        tramos: { select: { usuarioId: true, inicio: true, fin: true } },
      },
    }),
    // 3. Pendientes. Los que se sumaron a una tarea de resurtido no cuentan
    // aparte: su tiempo y sus unidades ya estan en esa tarea.
    prisma.pendienteGourmet.findMany({
      where: {
        deletedAt: null,
        tareaResurtidoId: null,
        horaInicio: { not: null, lt: finConsulta },
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
        horaInicio: { lt: finConsulta },
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
    // 5. Los cuadros de turno que cubren el periodo, para la jornada.
    prisma.cuadroTurnos.findMany({
      where: {
        deletedAt: null,
        desde: { lte: new Date(`${hasta}T00:00:00.000Z`) },
        hasta: { gte: new Date(`${diaAnterior}T00:00:00.000Z`) },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        desde: true, hasta: true,
        turnos: { select: { usuarioId: true, diaSemana: true, inicioMin: true, finMin: true } },
      },
    }),
    // 6. Lo que ya justificaron los supervisores sobre los tiempos muertos.
    prisma.justificacionTiempoMuerto.findMany({
      where: {
        deletedAt: null,
        usuarioId: { in: personas.map((p) => p.id) },
        inicio: { lt: finConsulta },
        fin: { gt: ini },
      },
      select: {
        id: true, usuarioId: true, inicio: true, fin: true, motivo: true, observacion: true,
        createdAt: true, justificadoPor: { select: { name: true } },
      },
    }),
  ])

  // Cada dia usa el cuadro mas reciente que lo cubra: si operacion sube uno
  // corregido, manda el nuevo sin tener que borrar el anterior.
  const medidosIds = new Set(personas.map((p) => p.id))
  // Tambien el dia anterior: su turno de noche se lleva la madrugada del primero.
  for (const dia of diasDelRango(diaAnterior, hasta)) {
    const cuadro = cuadros.find(
      (c) => c.desde.toISOString().slice(0, 10) <= dia && dia <= c.hasta.toISOString().slice(0, 10),
    )
    if (!cuadro) continue
    // getUTCDay sobre el mediodia de Bogota: el dia de la semana que se ve aqui.
    const diaSemana = new Date(`${dia}T12:00:00-05:00`).getUTCDay()
    for (const t of cuadro.turnos) {
      if (t.diaSemana !== diaSemana || !medidosIds.has(t.usuarioId)) continue
      const v = ventanaTurno(dia, { inicioMin: t.inicioMin, finMin: t.finMin })
      ventanas.push({ usuarioId: t.usuarioId, dia, inicio: v.inicio, fin: v.fin })
    }
  }

  for (const t of tramos) {
    const tipo = TIPO_MOVIMIENTO[t.movimiento.tipo]
    if (!tipo) continue
    const registro = `m:${t.movimientoId}`
    if (t.fin) tiempos.push({ usuarioId: t.usuarioId, inicio: t.inicio, fin: t.fin, tipo, registro })
    else enCurso.push({ usuarioId: t.usuarioId, inicio: t.inicio, fin: finAbierto(t.inicio, t.usuarioId), tipo, registro })
  }
  for (const m of cerrados) {
    if (m.horaFinalizacion) {
      unidades.push({ usuarioId: m.responsableId, cuando: m.horaFinalizacion, unidades: m.cantidadTotal })
    }
  }
  for (const t of tareas) {
    if (!t.horaInicio) continue
    const registro = `t:${t.id}`
    const cerrada = t.estado === 'COMPLETADA' && t.horaFin
    // Con tramos (desde que se pueden pasar a un ayudante), cada persona su
    // parte. Las de antes no tienen tramos: todo es del operario del montaje.
    const tramosTarea = t.tramos.length > 0
      ? t.tramos
      : [{ usuarioId: t.montaje.operarioId, inicio: t.horaInicio, fin: t.horaFin }]
    for (const tr of tramosTarea) {
      const base = { usuarioId: tr.usuarioId, inicio: tr.inicio, tipo: 'resurtido' as const, registro }
      if (cerrada && tr.fin) tiempos.push({ ...base, fin: tr.fin })
      else enCurso.push({ ...base, fin: tr.fin ?? finAbierto(tr.inicio, tr.usuarioId) })
    }
    // Las unidades son de quien la cerro.
    if (cerrada) {
      unidades.push({ usuarioId: t.responsableId ?? t.montaje.operarioId, cuando: t.horaFin!, unidades: t.unidadesBajadas ?? 0 })
    }
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
      else enCurso.push({ ...base, fin: t.fin ?? finAbierto(t.inicio, t.usuarioId) })
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
      else enCurso.push({ ...base, fin: finAbierto(r.horaInicio, uid) })
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
    data: agregarIndicadores({ personas, tiempos, unidades, ventanas, desde, hasta }),
    muertos: agregarTiemposMuertos({
      personas, tiempos: [...tiempos, ...enCurso], justificaciones, ventanas, desde, hasta,
    }),
  }
})
