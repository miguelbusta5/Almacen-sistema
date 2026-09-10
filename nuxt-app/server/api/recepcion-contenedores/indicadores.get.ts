import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { assertGestorRecepcion } from '../../utils/recepcion'
import { segundosRecepcion, unidadesPorHora, TIPOS_NOVEDAD_RECEPCION } from '../../utils/recepcionCalc'
import { parseDay, todayBogota } from '../../utils/exportacionesCalc'

/**
 * GET /api/recepcion-contenedores/indicadores?desde=&hasta=
 *
 * Solo supervision: son los numeros con los que se evalua al equipo y al
 * proveedor, no informacion operativa del turno.
 *
 * Se agrega en memoria y no con groupBy porque el tiempo no es una columna
 * (sale de hora fin - hora inicio) y porque los acumulados van en SEGUNDOS,
 * redondeando una sola vez al presentar.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertGestorRecepcion(actor.role, 'Los indicadores son para supervision')

  const sp = getQuery(event)
  const hoy = todayBogota(new Date())
  let desde = parseDay(sp.desde ? String(sp.desde) : null) ?? hoy
  let hasta = parseDay(sp.hasta ? String(sp.hasta) : null) ?? hoy
  if (desde.getTime() > hasta.getTime()) [desde, hasta] = [hasta, desde]

  const rows = await prisma.recepcionContenedor.findMany({
    where: { deletedAt: null, fecha: { gte: desde, lte: hasta } },
    select: {
      estado: true, proveedor: true, tipoProducto: true,
      cajas: true, unidades: true, estibasUsadas: true,
      referenciasEsperadas: true, referenciasNuevas: true, unidadesNuevas: true,
      horaInicio: true, horaFinalizacion: true,
      creadoPorId: true,
      creadoPor: { select: { name: true } },
      descargadores: { select: { usuarioId: true, usuario: { select: { name: true } } } },
      novedades: { select: { tipo: true, cantidad: true } },
    },
  })

  interface Acc { nombre: string; recepciones: number; unidades: number; segundos: number; cerradas: number }
  const porOperario = new Map<string, Acc>()
  const porDescargador = new Map<string, { nombre: string; recepciones: number; unidades: number }>()
  const porProveedor = new Map<string, { recepciones: number; unidades: number; novedades: number }>()

  const novedades: Record<string, { lineas: number; unidades: number }> = {}
  for (const t of TIPOS_NOVEDAD_RECEPCION) novedades[t] = { lineas: 0, unidades: 0 }

  let totalSegundos = 0
  let cerradas = 0
  let enCurso = 0
  let totalUnidades = 0
  let totalCajas = 0
  let totalEstibas = 0
  let refsNuevas = 0
  let unidadesNuevas = 0

  for (const r of rows) {
    totalUnidades += r.unidades
    totalCajas += r.cajas
    totalEstibas += r.estibasUsadas ?? 0
    refsNuevas += r.referenciasNuevas ?? 0
    unidadesNuevas += r.unidadesNuevas ?? 0
    if (r.estado === 'EN_CURSO') enCurso += 1

    const seg = r.estado === 'CERRADO' ? segundosRecepcion(r.horaInicio, r.horaFinalizacion) ?? 0 : 0
    if (r.estado === 'CERRADO') { cerradas += 1; totalSegundos += seg }

    const acc = porOperario.get(r.creadoPorId) ?? {
      nombre: r.creadoPor?.name ?? 'Usuario', recepciones: 0, unidades: 0, segundos: 0, cerradas: 0,
    }
    acc.recepciones += 1
    acc.unidades += r.unidades
    acc.segundos += seg
    if (r.estado === 'CERRADO') acc.cerradas += 1
    porOperario.set(r.creadoPorId, acc)

    for (const d of r.descargadores) {
      const prev = porDescargador.get(d.usuarioId) ?? {
        nombre: d.usuario?.name ?? 'Usuario', recepciones: 0, unidades: 0,
      }
      prev.recepciones += 1
      prev.unidades += r.unidades
      porDescargador.set(d.usuarioId, prev)
    }

    const prov = porProveedor.get(r.proveedor) ?? { recepciones: 0, unidades: 0, novedades: 0 }
    prov.recepciones += 1
    prov.unidades += r.unidades
    prov.novedades += r.novedades.length
    porProveedor.set(r.proveedor, prov)

    for (const n of r.novedades) {
      const slot = novedades[n.tipo]
      if (slot) { slot.lineas += 1; slot.unidades += n.cantidad }
    }
  }

  const promedio = (seg: number, n: number) => (n > 0 ? Math.round(seg / n) : null)

  return {
    success: true,
    rango: { desde: desde.toISOString().slice(0, 10), hasta: hasta.toISOString().slice(0, 10) },
    data: {
      resumen: {
        recepciones: rows.length,
        cerradas,
        enCurso,
        unidades: totalUnidades,
        cajas: totalCajas,
        estibas: totalEstibas,
        referenciasNuevas: refsNuevas,
        unidadesNuevas,
        segundos: totalSegundos,
        promedioSeg: promedio(totalSegundos, cerradas),
        unidadesPorHora: unidadesPorHora(totalUnidades, totalSegundos),
      },
      novedades,
      operarios: [...porOperario.entries()]
        .map(([id, a]) => ({
          id,
          nombre: a.nombre,
          recepciones: a.recepciones,
          unidades: a.unidades,
          segundos: a.segundos,
          promedioSeg: promedio(a.segundos, a.cerradas),
        }))
        .sort((x, y) => y.recepciones - x.recepciones),
      descargadores: [...porDescargador.entries()]
        .map(([id, a]) => ({ id, nombre: a.nombre, recepciones: a.recepciones, unidades: a.unidades }))
        .sort((x, y) => y.recepciones - x.recepciones),
      proveedores: [...porProveedor.entries()]
        .map(([nombre, a]) => ({ nombre, ...a }))
        .sort((x, y) => y.recepciones - x.recepciones),
    },
  }
})
