import { defineEventHandler, getQuery, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { esGestionMuebles, ROL_PICKING } from '../../utils/mueblesCalc'
import { diaBogota, limitesRango } from '../../utils/indicadoresCalc'
import { metaDeProceso, resumenProceso, type CierreProceso } from '../../utils/procesosCalc'

const RE_DIA = /^\d{4}-\d{2}-\d{2}$/
const MS_DIA = 86_400_000
const MAX_DIAS = 93
const diaMas = (dia: string, n: number) => diaBogota(new Date(new Date(`${dia}T12:00:00-05:00`).getTime() + n * MS_DIA))
const r1 = (v: number) => Math.round(v * 10) / 10

/**
 * GET /api/indicadores-muebles/procesos?desde&hasta&operarioId&inspectorId
 *
 * Picking e inspeccion por dia y por persona (PLU, unidades, m3, kg) con el
 * periodo anterior y la meta automatica (dia tipico de las 4 semanas
 * anteriores), y ebanisteria por PLU y por proveedor (fabricante del maestro).
 * Muebles trabaja de dia con turno fijo: el dia es el de calendario.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  if (!esGestionMuebles(actor.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Los indicadores de muebles son para supervision' })
  }
  const sp = getQuery(event)
  const hoy = diaBogota(new Date())
  let desde = RE_DIA.test(String(sp.desde ?? '')) ? String(sp.desde) : hoy
  let hasta = RE_DIA.test(String(sp.hasta ?? '')) ? String(sp.hasta) : hoy
  if (desde > hasta) [desde, hasta] = [hasta, desde]
  const largo = Math.round((new Date(`${hasta}T12:00:00Z`).getTime() - new Date(`${desde}T12:00:00Z`).getTime()) / MS_DIA) + 1
  if (largo > MAX_DIAS) desde = diaMas(hasta, -(MAX_DIAS - 1))
  const n = Math.min(largo, MAX_DIAS)
  const operarioId = sp.operarioId ? String(sp.operarioId) : null
  const inspectorId = sp.inspectorId ? String(sp.inspectorId) : null

  const actual = { desde, hasta }
  const anterior = { desde: diaMas(desde, -n), hasta: diaMas(desde, -1) }
  const metaVentana = { desde: diaMas(desde, -28), hasta: diaMas(desde, -1) }
  const primero = anterior.desde < metaVentana.desde ? anterior.desde : metaVentana.desde
  const ini = limitesRango(primero, hasta).inicio
  const fin = limitesRango(hasta, hasta).fin
  const enVentana = (d: string, v: { desde: string; hasta: string }) => d >= v.desde && d <= v.hasta

  const inicioActual = limitesRango(desde, hasta).inicio
  const [lineas, operarios, inspectores, sinCrear, lineasOvdm] = await Promise.all([
    prisma.lineaMuebles.findMany({
      where: {
        orden: { deletedAt: null },
        OR: [{ horaFin: { gte: ini, lte: fin } }, { inspHoraFin: { gte: ini, lte: fin } }, { ebanisteriaInicio: { gte: ini, lte: fin } }],
      },
      select: {
        plu: true, descripcion: true, unidades: true, operarioId: true, operario: { select: { role: true } },
        horaFin: true, inspectorId: true, inspHoraFin: true, ebanisteriaInicio: true, ebanisteriaFin: true,
        motivoEbanisteria: true, volumenTotalM3: true, pesoTotalKg: true,
      },
    }),
    prisma.user.findMany({ where: { role: ROL_PICKING }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.inspector.findMany({ select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } }),
    // Ordenes sin crear (24-09): las pickearon sin registrarlas; las creo inspeccion.
    prisma.ordenMuebles.findMany({
      where: {
        deletedAt: null, sinCrearPicking: true, horaPasoInspeccion: { gte: inicioActual, lte: fin },
        ...(operarioId && { operarioId }),
      },
      select: {
        codigo: true, horaPasoInspeccion: true, operarioId: true,
        inspector: { select: { nombre: true } }, _count: { select: { lineas: true } },
      },
      orderBy: { horaPasoInspeccion: 'desc' },
    }),
    // Valor de lo que se mueve en OVDM (24-09): PLU pickeados en el periodo y en
    // el anterior. Sin facturas de contado (tipo CONTADO) ni ordenes de tienda.
    prisma.lineaMuebles.findMany({
      where: {
        horaFin: { gte: limitesRango(anterior.desde, hasta).inicio, lte: fin },
        orden: { deletedAt: null, tipoOrden: 'OVDM', tiendaOrigenCodigo: null },
        ...(operarioId && { operarioId }),
      },
      select: { plu: true, unidades: true, horaFin: true, ordenId: true },
    }),
  ])

  const num = (v: unknown) => (v == null ? null : Number(v))
  // Picking: solo lo que pickeo un usuario de picking (el login de inspeccion
  // que agrega PLU a la orden no es un operario).
  const cPicking: CierreProceso[] = lineas
    .filter((l) => l.horaFin && l.operario?.role === ROL_PICKING)
    .map((l) => ({
      usuarioId: l.operarioId, dia: diaBogota(l.horaFin!), plu: l.plu, descripcion: l.descripcion,
      unidades: l.unidades, m3: num(l.volumenTotalM3), kg: num(l.pesoTotalKg),
    }))
  const cInspeccion: CierreProceso[] = lineas
    .filter((l) => l.inspHoraFin && l.inspectorId)
    .map((l) => ({
      usuarioId: l.inspectorId!, dia: diaBogota(l.inspHoraFin!), plu: l.plu, descripcion: l.descripcion,
      unidades: l.unidades, m3: num(l.volumenTotalM3), kg: num(l.pesoTotalKg),
    }))

  const nombres = new Map<string, string>([
    ...operarios.map((o) => [o.id, o.name] as [string, string]),
    ...inspectores.map((i) => [i.id, i.nombre] as [string, string]),
  ])
  const proceso = (todos: CierreProceso[], persona: string | null) => {
    const de = (l: CierreProceso[]) => (persona ? l.filter((c) => c.usuarioId === persona) : l)
    const meta = metaDeProceso(todos.filter((c) => enVentana(c.dia, metaVentana)))
    const act = resumenProceso(de(todos.filter((c) => enVentana(c.dia, actual))), nombres, meta)
    const ant = resumenProceso(de(todos.filter((c) => enVentana(c.dia, anterior))), nombres)
    return { actual: act, anterior: { total: ant.total, dias: ant.dias, equipoDia: ant.equipoDia, personaDia: ant.personaDia }, meta }
  }

  // ── Ebanisteria: que PLU van mas al taller, de que proveedor y cuanto esperan ──
  const eban = lineas.filter((l) => l.ebanisteriaInicio && enVentana(diaBogota(l.ebanisteriaInicio), actual)
    && (!inspectorId || l.inspectorId === inspectorId))
  const productos = await prisma.productoMaestro.findMany({
    where: { plu: { in: [...new Set(eban.map((l) => l.plu))] } },
    select: { plu: true, fabricante: true },
  })
  const proveedor = new Map(productos.map((p) => [p.plu, p.fabricante?.trim() || 'Sin proveedor']))
  const ahora = Date.now()
  const esperaMin = (l: (typeof eban)[number]) => ((l.ebanisteriaFin?.getTime() ?? ahora) - l.ebanisteriaInicio!.getTime()) / 60_000
  const agrupar = (clave: (l: (typeof eban)[number]) => string) => {
    const g = new Map<string, (typeof eban)>()
    for (const l of eban) g.set(clave(l), [...(g.get(clave(l)) ?? []), l])
    return g
  }
  const porPlu = [...agrupar((l) => l.plu).entries()].map(([plu, l]) => ({
    plu,
    descripcion: l[0]!.descripcion,
    proveedor: proveedor.get(plu) ?? 'Sin proveedor',
    veces: l.length,
    enTaller: l.filter((x) => !x.ebanisteriaFin).length,
    esperaMin: r1(l.reduce((s, x) => s + esperaMin(x), 0) / l.length),
    motivos: [...new Set(l.map((x) => x.motivoEbanisteria).filter(Boolean))].slice(0, 3) as string[],
  })).sort((a, b) => b.veces - a.veces || b.esperaMin - a.esperaMin)
  const porProveedor = [...agrupar((l) => proveedor.get(l.plu) ?? 'Sin proveedor').entries()].map(([nombre, l]) => ({
    proveedor: nombre,
    veces: l.length,
    plus: new Set(l.map((x) => x.plu)).size,
    esperaMin: r1(l.reduce((s, x) => s + esperaMin(x), 0) / l.length),
  })).sort((a, b) => b.veces - a.veces)

  // ── Valor movido en OVDM: unidades x precio de venta del maestro ──
  const precios = new Map((await prisma.productoMaestro.findMany({
    where: { plu: { in: [...new Set(lineasOvdm.map((l) => l.plu))] } },
    select: { plu: true, precio: true },
  })).map((p) => [p.plu, p.precio == null ? null : Number(p.precio)]))
  const valorDe = (v: { desde: string; hasta: string }) => {
    const dias = new Map<string, { dia: string; valor: number; ordenes: Set<string>; plus: number; unidades: number }>()
    let sinPrecio = 0
    for (const l of lineasOvdm) {
      const dia = diaBogota(l.horaFin!)
      if (!enVentana(dia, v)) continue
      const precio = precios.get(l.plu)
      if (precio == null || precio <= 0) sinPrecio++
      const d = dias.get(dia) ?? { dia, valor: 0, ordenes: new Set<string>(), plus: 0, unidades: 0 }
      d.valor += (precio ?? 0) * l.unidades
      d.ordenes.add(l.ordenId)
      d.plus++
      d.unidades += l.unidades
      dias.set(dia, d)
    }
    const porDia = [...dias.values()].sort((a, b) => a.dia.localeCompare(b.dia))
      .map((d) => ({ dia: d.dia, valor: Math.round(d.valor), ordenes: d.ordenes.size, plus: d.plus, unidades: d.unidades }))
    const total = porDia.reduce((s, d) => s + d.valor, 0)
    return { total, dias: porDia.length, porDia: porDia.length ? Math.round(total / porDia.length) : null, sinPrecio, serie: porDia }
  }
  const valorActual = valorDe(actual)
  const valorAnterior = valorDe(anterior)

  // Cuantas deja sin registrar cada operario.
  const sinCrearPorOperario = new Map<string, { ordenes: number; plus: number }>()
  for (const o of sinCrear) {
    const x = sinCrearPorOperario.get(o.operarioId) ?? { ordenes: 0, plus: 0 }
    x.ordenes++
    x.plus += o._count.lineas
    sinCrearPorOperario.set(o.operarioId, x)
  }

  return {
    success: true,
    rango: actual,
    anterior,
    metaVentana,
    operarios: operarios.map((o) => ({ id: o.id, nombre: o.name })),
    inspectores: inspectores.map((i) => ({ id: i.id, nombre: i.nombre })),
    picking: proceso(cPicking, operarioId),
    inspeccion: proceso(cInspeccion, inspectorId),
    valorOvdm: {
      ...valorActual,
      anterior: { total: valorAnterior.total, dias: valorAnterior.dias, porDia: valorAnterior.porDia },
    },
    sinCrear: {
      total: sinCrear.length,
      porOperario: [...sinCrearPorOperario.entries()]
        .map(([id, x]) => ({ operarioId: id, nombre: nombres.get(id) ?? '—', ...x }))
        .sort((a, b) => b.ordenes - a.ordenes),
      ordenes: sinCrear.slice(0, 50).map((o) => ({
        codigo: o.codigo, dia: diaBogota(o.horaPasoInspeccion!), operario: nombres.get(o.operarioId) ?? '—',
        inspector: o.inspector?.nombre ?? '—', plus: o._count.lineas,
      })),
    },
    ebanisteria: {
      enviados: eban.length,
      enTaller: eban.filter((l) => !l.ebanisteriaFin).length,
      esperaMin: eban.length ? r1(eban.reduce((s, l) => s + esperaMin(l), 0) / eban.length) : null,
      porPlu: porPlu.slice(0, 25),
      porProveedor,
    },
  }
})
