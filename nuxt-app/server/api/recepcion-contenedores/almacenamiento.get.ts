import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { almacenamientoDeRecepciones, assertGestorRecepcion, assertUsuarioRecepcion } from '../../utils/recepcion'
import { clavePedidoRecepcion, proyeccionContenedores } from '../../utils/recepcionAlmacenamientoCalc'
import { diaBogota, limitesRango } from '../../utils/indicadoresCalc'

const RE_DIA = /^\d{4}-\d{2}-\d{2}$/
const MAX_DIAS = 366

/**
 * GET /api/recepcion-contenedores/almacenamiento - cuanto cuesta un contenedor
 * de punta a punta (descarga + almacenamiento) y cuantos caben por dia, por
 * tipo de contenedor. Solo supervision.
 *
 * El almacenamiento sale de Control Montacargas: los PLU recibidos con el mismo
 * numero de pedido, que se pide desde el 24-09. Antes de esa fecha no hay datos.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioRecepcion(actor.role)
  assertGestorRecepcion(actor.role, 'La proyección de contenedores es para supervisión')

  const sp = getQuery(event)
  const hoy = diaBogota(new Date())
  const hace30 = diaBogota(new Date(Date.now() - 29 * 86_400_000))
  let desde = RE_DIA.test(String(sp.desde ?? '')) ? String(sp.desde) : hace30
  let hasta = RE_DIA.test(String(sp.hasta ?? '')) ? String(sp.hasta) : hoy
  if (desde > hasta) [desde, hasta] = [hasta, desde]
  const dias = (new Date(`${hasta}T12:00:00Z`).getTime() - new Date(`${desde}T12:00:00Z`).getTime()) / 86_400_000 + 1
  if (dias > MAX_DIAS) desde = diaBogota(new Date(new Date(`${hasta}T12:00:00Z`).getTime() - (MAX_DIAS - 1) * 86_400_000))
  const { inicio, fin } = limitesRango(desde, hasta)

  const recs = await prisma.recepcionContenedor.findMany({
    where: { deletedAt: null, horaInicio: { gte: inicio, lte: fin } },
    select: {
      id: true, numeroPedido: true, proveedor: true, tipoContenedor: true, tipoProducto: true,
      estado: true, fecha: true, horaInicio: true,
    },
    orderBy: { horaInicio: 'desc' },
  })
  const { porRecepcion, sinContenedor } = await almacenamientoDeRecepciones(recs)

  // Montacarguistas que recibieron por dia en el periodo: la plantilla por
  // defecto de la proyeccion (se puede cambiar para simular).
  const tramos = await prisma.tramoMontacargas.findMany({
    where: { inicio: { gte: inicio, lte: fin }, movimiento: { tipo: 'RECEPCION', deletedAt: null } },
    select: { usuarioId: true, inicio: true },
  })
  const porDia = new Map<string, Set<string>>()
  for (const t of tramos) {
    const d = diaBogota(t.inicio)
    const s = porDia.get(d) ?? new Set<string>()
    s.add(t.usuarioId)
    porDia.set(d, s)
  }
  const observados = porDia.size
    ? Math.round(([...porDia.values()].reduce((s, x) => s + x.size, 0) / porDia.size) * 10) / 10
    : null

  const entero = (v: unknown, min: number, max: number) => {
    const n = Number(v)
    return Number.isFinite(n) && n >= min && n <= max ? n : null
  }
  const plantilla = {
    horas: entero(sp.horas, 1, 24) ?? 8,
    montacarguistas: entero(sp.montacarguistas, 1, 30) ?? Math.max(1, Math.round(observados ?? 1)),
  }

  // Nombre de cada montacarguista del desglose (tiempo entre PLU por persona).
  const idsMont = [...new Set([...porRecepcion.values()].flatMap((a) => a.desglose.porMontacarguista.map((m) => m.usuarioId)))]
  const nombreMont = new Map(
    (idsMont.length ? await prisma.user.findMany({ where: { id: { in: idsMont } }, select: { id: true, name: true } }) : [])
      .map((u) => [u.id, u.name]),
  )
  const contenedores = recs.map((x) => {
    const alm = porRecepcion.get(x.id)!
    return {
      id: x.id,
      numeroPedido: x.numeroPedido,
      proveedor: x.proveedor,
      tipoContenedor: x.tipoContenedor,
      tipoProducto: x.tipoProducto,
      fecha: x.fecha.toISOString().slice(0, 10),
      alm: {
        ...alm,
        desglose: {
          ...alm.desglose,
          porMontacarguista: alm.desglose.porMontacarguista.map((m) => ({ ...m, nombre: nombreMont.get(m.usuarioId) ?? '—' })),
        },
      },
    }
  })

  // PLU recibidos con un pedido que no coincide con ninguna recepcion: casi
  // siempre un pedido mal escrito. Se muestran para corregirlos.
  const huerfanos = new Map<string, { numeroPedido: string; movimientos: number; plus: Set<string>; desde: Date }>()
  for (const m of sinContenedor) {
    const h = huerfanos.get(m.numeroPedido) ?? { numeroPedido: m.numeroPedido, movimientos: 0, plus: new Set<string>(), desde: m.horaInicio }
    h.movimientos++
    h.plus.add(m.plu)
    if (m.horaInicio < h.desde) h.desde = m.horaInicio
    huerfanos.set(m.numeroPedido, h)
  }
  // Los huerfanos del periodo (los de las recepciones no los trae la consulta
  // de arriba, que parte de las recepciones): se buscan aparte.
  const sueltos = await prisma.movimientoMontacargas.groupBy({
    by: ['numeroPedido'],
    where: {
      deletedAt: null, tipo: 'RECEPCION', horaInicio: { gte: inicio, lte: fin },
      numeroPedido: { not: null, notIn: [...new Set(recs.map((x) => x.numeroPedido))] },
    },
    _count: { _all: true },
    _min: { horaInicio: true },
  })
  const clavesRecs = new Set(recs.map((x) => clavePedidoRecepcion(x.numeroPedido)))
  for (const g of sueltos) {
    if (!g.numeroPedido || huerfanos.has(g.numeroPedido)) continue
    // "1921" es del contenedor PEDDM1921 aunque no se escribiera igual.
    if (clavesRecs.has(clavePedidoRecepcion(g.numeroPedido))) continue
    huerfanos.set(g.numeroPedido, { numeroPedido: g.numeroPedido, movimientos: g._count._all, plus: new Set(), desde: g._min.horaInicio! })
  }

  return {
    success: true,
    rango: { desde, hasta },
    plantilla,
    montacarguistasObservados: observados,
    porTipo: proyeccionContenedores(
      contenedores.filter((c) => c.alm.completo).map((c) => ({ tipoContenedor: c.tipoContenedor, alm: c.alm })),
      plantilla,
    ),
    contenedores,
    sinContenedor: [...huerfanos.values()].map((h) => ({
      numeroPedido: h.numeroPedido, movimientos: h.movimientos, plus: h.plus.size || null, desde: h.desde.toISOString(),
    })),
  }
})
