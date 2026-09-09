import { defineEventHandler, getQuery, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { parseDay, todayBogota } from '../../utils/exportacionesCalc'
import { assertGestorMontacargas } from '../../utils/montacargas'
import {
  esTipoMovimiento, huboTraspaso, segundosDelCreador, segundosTrabajados,
} from '../../utils/montacargasCalc'

/**
 * GET /api/montacargas/indicadores?tipo=&desde=&hasta=
 *
 * Productividad del periodo. Solo gestión, igual que el Excel: son los numeros
 * con los que se evalua al equipo, no informacion operativa del turno.
 *
 * La agregacion se hace en memoria y no con groupBy a proposito: el tiempo no es
 * una columna, sale de sumar los tramos de cada persona (ver segundosTrabajados),
 * y la ventana de una novedad tiene que quedar fuera.
 *
 * Todo se acumula en SEGUNDOS y se redondea una sola vez, al presentar. Sumando
 * minutos ya redondeados, los registros de menos de medio minuto —la mayoria en
 * resurtido— aportaban cero y el equipo aparecia sin haber trabajado.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertGestorMontacargas(actor.role, 'Los indicadores son para supervision')

  const sp = getQuery(event)
  const tipo = String(sp.tipo ?? '').trim()
  if (!esTipoMovimiento(tipo)) {
    throw createError({ statusCode: 400, statusMessage: 'Tipo de registro invalido' })
  }

  const hoy = todayBogota()
  let desde = parseDay(sp.desde ? String(sp.desde) : null) ?? hoy
  let hasta = parseDay(sp.hasta ? String(sp.hasta) : null) ?? hoy
  if (desde.getTime() > hasta.getTime()) [desde, hasta] = [hasta, desde]

  const registros = await prisma.movimientoMontacargas.findMany({
    where: { tipo, deletedAt: null, fecha: { gte: desde, lte: hasta } } as never,
    select: {
      estado: true,
      cajas: true,
      unidadesSueltas: true,
      cantidadTotal: true,
      creadoPorId: true,
      creadoPor: { select: { name: true } },
      tramos: { select: { usuarioId: true, inicio: true, fin: true } },
      novedades: { select: { resueltaAt: true } },
    },
  })

  interface Acc {
    nombre: string
    registros: number
    unidades: number
    cajas: number
    sueltas: number
    segundos: number
    cerrados: number
  }
  const porPersona = new Map<string, Acc>()
  const suma = (id: string, nombre: string, patch: Partial<Acc>) => {
    const a = porPersona.get(id) ?? {
      nombre, registros: 0, unidades: 0, cajas: 0, sueltas: 0, segundos: 0, cerrados: 0,
    }
    a.nombre = nombre || a.nombre
    a.registros += patch.registros ?? 0
    a.unidades += patch.unidades ?? 0
    a.cajas += patch.cajas ?? 0
    a.sueltas += patch.sueltas ?? 0
    a.segundos += patch.segundos ?? 0
    a.cerrados += patch.cerrados ?? 0
    porPersona.set(id, a)
  }

  let totalRegistros = 0
  let totalUnidades = 0
  let totalSegundos = 0
  let cerrados = 0
  let conNovedadAbierta = 0
  let novedadesResueltas = 0
  let traspasados = 0

  // Segundos por ayudante: cada tramo que no es del creador es trabajo suyo.
  const ayudantes = new Map<string, { nombre: string; segundos: number; recibidos: number }>()

  for (const r of registros) {
    totalRegistros += 1
    totalUnidades += r.cantidadTotal
    totalSegundos += segundosTrabajados(r.tramos)
    if (r.estado === 'CERRADO') cerrados += 1
    if (r.estado === 'NOVEDAD') conNovedadAbierta += 1
    novedadesResueltas += r.novedades.filter((n) => n.resueltaAt).length

    suma(r.creadoPorId, r.creadoPor?.name ?? 'Usuario', {
      registros: 1,
      unidades: r.cantidadTotal,
      cajas: r.cajas,
      sueltas: r.unidadesSueltas,
      segundos: segundosDelCreador(r.tramos, r.creadoPorId),
      cerrados: r.estado === 'CERRADO' ? 1 : 0,
    })

    if (huboTraspaso(r.tramos, r.creadoPorId)) {
      traspasados += 1
      const suyos = new Set(
        r.tramos.filter((t) => t.usuarioId !== r.creadoPorId).map((t) => t.usuarioId),
      )
      for (const uid of suyos) {
        const previo = ayudantes.get(uid) ?? { nombre: '', segundos: 0, recibidos: 0 }
        previo.segundos += segundosTrabajados(r.tramos.filter((t) => t.usuarioId === uid))
        previo.recibidos += 1
        ayudantes.set(uid, previo)
      }
    }
  }

  // Los nombres de los ayudantes en una sola consulta.
  if (ayudantes.size > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: [...ayudantes.keys()] } },
      select: { id: true, name: true },
    })
    for (const u of users) {
      const a = ayudantes.get(u.id)
      if (a) a.nombre = u.name
    }
  }

  // Se divide sobre los segundos exactos y se redondea aqui, una sola vez.
  const promedio = (seg: number, n: number) => (n > 0 ? Math.round(seg / n) : null)

  return {
    success: true,
    rango: { desde: desde.toISOString().slice(0, 10), hasta: hasta.toISOString().slice(0, 10) },
    data: {
      resumen: {
        registros: totalRegistros,
        cerrados,
        unidades: totalUnidades,
        segundos: totalSegundos,
        promedioSeg: promedio(totalSegundos, cerrados),
        traspasados,
        conNovedadAbierta,
        novedadesResueltas,
      },
      montacarguistas: [...porPersona.entries()]
        .map(([id, a]) => ({
          id,
          nombre: a.nombre,
          registros: a.registros,
          unidades: a.unidades,
          cajas: a.cajas,
          sueltas: a.sueltas,
          segundos: a.segundos,
          promedioSeg: promedio(a.segundos, a.cerrados),
        }))
        .sort((x, y) => y.registros - x.registros),
      ayudantes: [...ayudantes.entries()]
        .map(([id, a]) => ({
          id,
          nombre: a.nombre || 'Usuario',
          recibidos: a.recibidos,
          segundos: a.segundos,
          promedioSeg: promedio(a.segundos, a.recibidos),
        }))
        .sort((x, y) => y.recibidos - x.recibidos),
    },
  }
})
