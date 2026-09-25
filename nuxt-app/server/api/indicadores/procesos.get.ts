import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { assertGestorMontacargas } from '../../utils/montacargas'
import {
  cerradoPor, clasificarJornadas, diaBogota, diaDeTurnoDeInstante, esJornada, limitesRango, participantesDe,
  recortarAlTurno, type VentanaTurno,
} from '../../utils/indicadoresCalc'
import { ventanaTurno } from '../../utils/turnosCalc'
import { medidasDePlus } from '../../utils/carga'
import { cargaDeUnidades } from '../../utils/cargaCalc'
import { almacenamientoDeRecepciones } from '../../utils/recepcion'
import {
  metaDeProceso, montacarguistasRecepcion, resumenGenerales, resumenProceso, resumenRecepcion,
  type CierreProceso, type ContenedorProceso, type TramoGeneral,
} from '../../utils/procesosCalc'

const RE_DIA = /^\d{4}-\d{2}-\d{2}$/
const MS_DIA = 86_400_000
const MAX_DIAS = 93
const diaMas = (dia: string, n: number) => diaBogota(new Date(new Date(`${dia}T12:00:00-05:00`).getTime() + n * MS_DIA))

/**
 * GET /api/indicadores/procesos?desde&hasta&usuarioId&turno - Indicadores por
 * proceso del area de almacenamiento: recepcion de contenedores, movimientos
 * (Control Montacargas: movimiento y resurtido), pendientes, resurtido (normal
 * y por capacidad) y tareas generales.
 *
 * Cada proceso trae el periodo, el periodo anterior del mismo largo (para
 * comparar) y su meta automatica: el dia tipico de las 4 semanas anteriores.
 * El calculo esta en procesosCalc.ts; aqui solo se juntan las filas.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertGestorMontacargas(actor.role, 'Los indicadores son para supervision')

  const sp = getQuery(event)
  const hoy = diaBogota(new Date())
  let desde = RE_DIA.test(String(sp.desde ?? '')) ? String(sp.desde) : hoy
  let hasta = RE_DIA.test(String(sp.hasta ?? '')) ? String(sp.hasta) : hoy
  if (desde > hasta) [desde, hasta] = [hasta, desde]
  const largo = Math.round((new Date(`${hasta}T12:00:00Z`).getTime() - new Date(`${desde}T12:00:00Z`).getTime()) / MS_DIA) + 1
  if (largo > MAX_DIAS) desde = diaMas(hasta, -(MAX_DIAS - 1))
  const n = Math.min(largo, MAX_DIAS)
  const usuarioId = sp.usuarioId ? String(sp.usuarioId) : null
  const turno = esJornada(sp.turno) ? sp.turno : null

  // Tres ventanas: el periodo, el anterior del mismo largo y las 4 semanas de la meta.
  const anterior = { desde: diaMas(desde, -n), hasta: diaMas(desde, -1) }
  const metaVentana = { desde: diaMas(desde, -28), hasta: diaMas(desde, -1) }
  const primero = anterior.desde < metaVentana.desde ? anterior.desde : metaVentana.desde
  const ini = limitesRango(primero, hasta).inicio
  // La madrugada del turno de noche del ultimo dia cae despues de medianoche.
  const fin = new Date(limitesRango(hasta, hasta).fin.getTime() + 12 * 3600_000)
  const enVentana = (d: string, v: { desde: string; hasta: string }) => d >= v.desde && d <= v.hasta
  const actual = { desde, hasta }

  const [movs, pends, tareas, generales, solicitados, cuadros] = await Promise.all([
    prisma.movimientoMontacargas.findMany({
      where: { deletedAt: null, estado: 'CERRADO', tipo: { in: ['MOVIMIENTO', 'RESURTIDO'] }, horaFinalizacion: { gte: ini, lte: fin } },
      select: { plu: true, descripcion: true, cantidadTotal: true, responsableId: true, horaFinalizacion: true, tramos: { select: { usuarioId: true, orden: true } } },
    }),
    prisma.pendienteGourmet.findMany({
      where: { deletedAt: null, tareaResurtidoId: null, estado: 'COMPLETADO', operarioId: { not: null }, horaFin: { gte: ini, lte: fin } },
      select: { plu: true, descripcion: true, unidadesBajadas: true, operarioId: true, horaFin: true, tramos: { select: { usuarioId: true, orden: true } } },
    }),
    prisma.tareaResurtido.findMany({
      where: { estado: 'COMPLETADA', horaFin: { gte: ini, lte: fin }, montaje: { deletedAt: null } },
      select: {
        plu: true, descripcion: true, unidadesBajadas: true, responsableId: true, horaFin: true,
        montaje: { select: { operarioId: true, nombreArchivo: true } },
        tramos: { select: { usuarioId: true, orden: true } },
      },
    }),
    prisma.asignadoTareaGeneral.findMany({
      where: { horaFin: { not: null, gte: ini, lte: fin } },
      select: { usuarioId: true, horaInicio: true, horaFin: true, tarea: { select: { descripcion: true } } },
    }),
    // El PLU mas solicitado: lo que se pidio en el periodo, se haya ubicado o no.
    prisma.pendienteGourmet.groupBy({
      by: ['plu', 'descripcion'],
      where: { deletedAt: null, solicitadoAt: { gte: limitesRango(desde, hasta).inicio, lte: limitesRango(desde, hasta).fin } },
      _count: { _all: true },
      _sum: { unidadesSolicitadas: true },
      orderBy: { _count: { plu: 'desc' } },
      take: 15,
    }),
    prisma.cuadroTurnos.findMany({
      where: { deletedAt: null, desde: { lte: new Date(`${hasta}T00:00:00.000Z`) }, hasta: { gte: new Date(`${diaMas(primero, -1)}T00:00:00.000Z`) } },
      orderBy: { createdAt: 'desc' },
      select: { desde: true, hasta: true, turnos: { select: { usuarioId: true, diaSemana: true, inicioMin: true, finMin: true } } },
    }),
  ])

  // ── Turnos: con ellos cada cierre cae en su dia de turno (la noche entera) ──
  const ventanas: VentanaTurno[] = []
  for (let d = diaMas(primero, -1); d <= hasta; d = diaMas(d, 1)) {
    const cuadro = cuadros.find((c) => c.desde.toISOString().slice(0, 10) <= d && d <= c.hasta.toISOString().slice(0, 10))
    if (!cuadro) continue
    const diaSemana = new Date(`${d}T12:00:00-05:00`).getUTCDay()
    for (const t of cuadro.turnos) {
      if (t.diaSemana !== diaSemana) continue
      const v = ventanaTurno(d, { inicioMin: t.inicioMin, finMin: t.finMin })
      ventanas.push({ usuarioId: t.usuarioId, dia: d, inicio: v.inicio, fin: v.fin })
    }
  }
  const porPersona = new Map<string, VentanaTurno[]>()
  for (const v of ventanas) porPersona.set(v.usuarioId, [...(porPersona.get(v.usuarioId) ?? []), v])
  const diaDe = (usuario: string, cuando: Date) => diaDeTurnoDeInstante(cuando, porPersona.get(usuario) ?? [], '0000-00-00', '9999-99-99')

  // ── Cierres de cada proceso ──
  const medidas = await medidasDePlus([...movs, ...pends, ...tareas].map((x) => x.plu))
  // El registro cuenta a todos los que lo tuvieron (24-09); cae en el dia de
  // turno de quien lo cerro.
  type Tramo = { usuarioId: string; orden: number }
  const cierre = (tramos: Tramo[], respaldo: string, cuando: Date, plu: string, descripcion: string | null, unidades: number): CierreProceso => {
    const usuario = cerradoPor(tramos, respaldo)
    const c = cargaDeUnidades(unidades, medidas.get(plu))
    return { usuarioId: usuario, participantes: participantesDe(tramos, usuario), dia: diaDe(usuario, cuando), plu, descripcion, unidades, m3: c.m3, kg: c.kg }
  }
  const cMovs = movs.map((m) => cierre(m.tramos, m.responsableId, m.horaFinalizacion!, m.plu, m.descripcion, m.cantidadTotal))
  const cPends = pends.map((p) => cierre(p.tramos, p.operarioId!, p.horaFin!, p.plu, p.descripcion, p.unidadesBajadas ?? 0))
  const esCapacidad = (t: (typeof tareas)[number]) => /^capacidad/i.test(t.montaje.nombreArchivo ?? '')
  const cTarea = (t: (typeof tareas)[number]) =>
    cierre(t.tramos, t.responsableId ?? t.montaje.operarioId, t.horaFin!, t.plu, t.descripcion, t.unidadesBajadas ?? 0)
  const cResNormal = tareas.filter((t) => !esCapacidad(t)).map(cTarea)
  const cResCapacidad = tareas.filter(esCapacidad).map(cTarea)

  // Tareas generales: recortadas al turno + 1 h, como en el tiempo laborado.
  const tGen: TramoGeneral[] = generales.map((a) => {
    const t = recortarAlTurno({ usuarioId: a.usuarioId, inicio: a.horaInicio, fin: a.horaFin! }, ventanas)
    return {
      usuarioId: a.usuarioId,
      dia: diaDe(a.usuarioId, a.horaInicio),
      descripcion: a.tarea.descripcion,
      segundos: Math.max(0, Math.round((t.fin.getTime() - t.inicio.getTime()) / 1000)),
    }
  })

  // ── Nombres ──
  const todosCierres = [...cMovs, ...cPends, ...cResNormal, ...cResCapacidad]
  const ids = new Set([...todosCierres.flatMap((c) => c.participantes ?? [c.usuarioId]), ...tGen.map((t) => t.usuarioId)])
  const usuarios = await prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true } })
  const nombres = new Map(usuarios.map((u) => [u.id, u.name]))

  // ── Turno dia / noche, como en el resto de indicadores: manda el cuadro y,
  // sin cuadro, la hora a la que trabajo. Se clasifica por el periodo; quien no
  // trabajo en el, por toda la ventana (cuenta para la meta y el anterior).
  const personasIds = [...ids].map((id) => ({ id, nombre: nombres.get(id) ?? '', rol: '' }))
  const deRegistro = (tramos: Tramo[], respaldo: string, cuando: Date) =>
    participantesDe(tramos, cerradoPor(tramos, respaldo)).map((u) => ({ usuarioId: u, inicio: cuando }))
  const tiemposJ = [
    ...movs.flatMap((m) => deRegistro(m.tramos, m.responsableId, m.horaFinalizacion!)),
    ...pends.flatMap((p) => deRegistro(p.tramos, p.operarioId!, p.horaFin!)),
    ...tareas.flatMap((t) => deRegistro(t.tramos, t.responsableId ?? t.montaje.operarioId, t.horaFin!)),
    ...generales.map((a) => ({ usuarioId: a.usuarioId, inicio: a.horaInicio })),
  ]
  const enPeriodo = (d: Date) => d >= limitesRango(desde, hasta).inicio && d <= fin
  const jPeriodo = clasificarJornadas({ personas: personasIds, ventanas, tiempos: tiemposJ.filter((t) => enPeriodo(t.inicio)), desde, hasta })
  const jVentana = clasificarJornadas({ personas: personasIds, ventanas, tiempos: tiemposJ, desde: primero, hasta })
  const activosPeriodo = new Set([
    ...ventanas.filter((v) => enVentana(v.dia, actual)).map((v) => v.usuarioId),
    ...tiemposJ.filter((t) => enPeriodo(t.inicio)).map((t) => t.usuarioId),
  ])
  const jornadaDe = (id: string) => (activosPeriodo.has(id) ? jPeriodo.get(id) : jVentana.get(id))
  const delTurno = turno ? new Set([...ids].filter((id) => jornadaDe(id) === turno)) : null
  // A quienes se acredita: las del turno pedido y, si se filtra, solo esa persona.
  const permitidas = turno || usuarioId
    ? new Set([...ids].filter((id) => (!delTurno || delTurno.has(id)) && (!usuarioId || id === usuarioId)))
    : null

  const dePersona = <T extends { usuarioId: string }>(l: T[]) => (permitidas ? l.filter((x) => permitidas.has(x.usuarioId)) : l)
  // La meta es del equipo del turno, aunque se filtre una persona.
  const delTurnoMeta = (l: CierreProceso[]) => delTurno
    ? l.map((c) => ({ ...c, participantes: (c.participantes ?? [c.usuarioId]).filter((u) => delTurno.has(u)) }))
      .filter((c) => c.participantes.length)
    : l
  const proceso = (todos: CierreProceso[]) => {
    const meta = metaDeProceso(delTurnoMeta(todos.filter((c) => enVentana(c.dia, metaVentana))))
    const act = resumenProceso(todos.filter((c) => enVentana(c.dia, actual)), nombres, meta, permitidas)
    const ant = resumenProceso(todos.filter((c) => enVentana(c.dia, anterior)), nombres, null, permitidas)
    return { actual: act, anterior: { total: ant.total, dias: ant.dias, equipoDia: ant.equipoDia, personaDia: ant.personaDia }, meta }
  }

  // ── Recepcion de contenedores (cerradas en el periodo y en el anterior) ──
  const recs = await prisma.recepcionContenedor.findMany({
    where: {
      deletedAt: null, estado: 'CERRADO',
      horaFinalizacion: { gte: limitesRango(anterior.desde, hasta).inicio, lte: limitesRango(hasta, hasta).fin },
    },
    select: {
      id: true, numeroPedido: true, proveedor: true, tipoContenedor: true, unidades: true, pesoKg: true,
      horaInicio: true, horaFinalizacion: true, pausaSegundos: true, creadoPorId: true,
      descargadores: { select: { usuarioId: true } },
    },
  })
  const { porRecepcion } = await almacenamientoDeRecepciones(recs)
  const contenedor = (x: (typeof recs)[number]): ContenedorProceso & { dia: string; ids: string[] } => {
    const alm = porRecepcion.get(x.id)
    const descargaSeg = Math.max(0, Math.round((x.horaFinalizacion!.getTime() - x.horaInicio.getTime()) / 1000 - (x.pausaSegundos ?? 0)))
    const descargaMin = descargaSeg / 60
    const conAlm = !!alm && alm.movimientos > 0
    const personas = new Set([x.creadoPorId, ...x.descargadores.map((d) => d.usuarioId), ...(alm?.montacarguistaIds ?? [])])
    return {
      ids: [...personas],
      dia: diaBogota(x.horaFinalizacion!),
      proveedor: x.proveedor,
      tipoContenedor: x.tipoContenedor,
      unidades: x.unidades,
      pesoKg: Number(x.pesoKg),
      m3: conAlm ? alm!.m3 : null,
      descargaMin,
      almacenamientoMin: conAlm ? alm!.almacenamientoRelojSeg / 60 : null,
      trabajoMin: conAlm && alm!.trabajoSeg != null ? alm!.trabajoSeg / 60 : null,
      cicloMin: conAlm && alm!.cicloSeg != null ? alm!.cicloSeg / 60 : null,
      totalSeg: conAlm ? alm!.totalSeg : null,
      descargaSeg,
      desglose: conAlm ? { ...alm!.desglose, trabajoSeg: alm!.trabajoSeg, cicloSeg: alm!.cicloSeg } : null,
      personas: personas.size,
    }
  }
  // Con filtro de turno o persona: los contenedores en que participo alguien que entra.
  const cont = recs.map(contenedor).filter((c) => !permitidas || c.ids.some((id) => permitidas.has(id)))
  // Nombres de los montacarguistas de recepcion que no salieron en otro proceso.
  const faltan = [...new Set(cont.flatMap((c) => c.desglose?.porMontacarguista.map((m) => m.usuarioId) ?? []))].filter((id) => !nombres.has(id))
  const nombresRecepcion = new Map(nombres)
  if (faltan.length) {
    for (const u of await prisma.user.findMany({ where: { id: { in: faltan } }, select: { id: true, name: true } })) nombresRecepcion.set(u.id, u.name)
  }

  const genAct = resumenGenerales(dePersona(tGen.filter((t) => enVentana(t.dia, actual))), nombres)
  const genAnt = resumenGenerales(dePersona(tGen.filter((t) => enVentana(t.dia, anterior))), nombres)

  return {
    success: true,
    rango: actual,
    anterior,
    metaVentana,
    recepcion: {
      actual: {
        ...resumenRecepcion(cont.filter((c) => enVentana(c.dia, actual))),
        montacarguistas: montacarguistasRecepcion(cont.filter((c) => enVentana(c.dia, actual)), nombresRecepcion),
      },
      anterior: resumenRecepcion(cont.filter((c) => enVentana(c.dia, anterior))).general,
    },
    movimientos: proceso(cMovs),
    pendientes: {
      ...proceso(cPends),
      solicitados: solicitados.map((s) => ({ plu: s.plu, descripcion: s.descripcion, veces: s._count._all, unidades: s._sum.unidadesSolicitadas ?? 0 })),
    },
    resurtido: {
      normal: proceso(cResNormal),
      capacidad: proceso(cResCapacidad),
      total: proceso([...cResNormal, ...cResCapacidad]),
    },
    generales: {
      actual: genAct,
      anterior: { segundos: genAnt.segundos, dias: genAnt.dias, equipoDiaSeg: genAnt.equipoDiaSeg, personaDiaSeg: genAnt.personaDiaSeg },
    },
  }
})
