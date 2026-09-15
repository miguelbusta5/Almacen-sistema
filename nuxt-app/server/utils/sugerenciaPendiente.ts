import type { Prisma } from '@prisma/client'
import {
  claveUbicacion, sugerirAlturas, teoricoVigente,
  type FilaTeorico, type SugerenciaPendiente,
} from './sugerenciaPendienteCalc'
import { textoPicking } from './pickingCalc'

type Tx = Prisma.TransactionClient

/**
 * Calcula de que altura(s) sacar un pendiente y a que picking llevarlo.
 *
 * - Teorico: el ultimo cargado, solo si es de las ultimas 12 horas.
 * - Picking: el registrado en Capacidad picking; si el PLU no esta, el RETIRO del teorico.
 * - A cada altura se le descuenta lo ya comprometido por pendientes abiertos
 *   (su sugerencia) y por tareas de resurtido abiertas del mismo PLU.
 *
 * Corre dentro de la transaccion de asignar, que ya tiene el bloqueo de
 * operaciones de almacen: dos asignaciones a la vez no comprometen lo mismo.
 */
export async function calcularSugerenciaPendiente(
  tx: Tx,
  pendiente: { id: string; plu: string; unidadesSolicitadas: number },
  ahora = new Date(),
): Promise<SugerenciaPendiente> {
  const plu = textoPicking(pendiente.plu)
  const [teorico, producto, capacidad] = await Promise.all([
    tx.pickingTeorico.findFirst({ orderBy: { creadoAt: 'desc' }, select: { id: true, creadoAt: true, filas: true } }),
    tx.productoMaestro.findUnique({ where: { plu: pendiente.plu }, select: { unidadesPorCaja: true } }),
    tx.pickingCapacidad.findUnique({ where: { plu: pendiente.plu }, select: { ubicacion: true } }),
  ])
  const unidadesPorCaja = producto?.unidadesPorCaja && producto.unidadesPorCaja > 0 ? producto.unidadesPorCaja : null
  const vigente = teorico && teoricoVigente(teorico.creadoAt, ahora) ? teorico : null
  const filas = vigente
    ? (vigente.filas as unknown as FilaTeorico[]).filter((f) => textoPicking(f.plu) === plu)
    : []

  const avisos: string[] = []
  let picking: string | null = capacidad?.ubicacion ?? null
  let pickingOrigen: SugerenciaPendiente['pickingOrigen'] = picking ? 'CAPACIDAD' : null
  if (!picking) {
    const retiro = filas.find((f) => f.concepto === 'RETIRO')
    if (retiro) { picking = retiro.ubicacion; pickingOrigen = 'TEORICO' }
  }

  const base: SugerenciaPendiente = {
    teoricoId: vigente?.id ?? null,
    teoricoCreadoAt: vigente?.creadoAt.toISOString() ?? null,
    calculadoAt: ahora.toISOString(),
    picking, pickingOrigen, unidadesPorCaja,
    unidadesSugeridas: pendiente.unidadesSolicitadas, alturas: [], faltante: 0, avisos,
  }
  if (!picking) avisos.push('Sin picking registrado en Capacidad picking ni en el teórico')
  if (!vigente) {
    avisos.push('Sin teórico vigente (últimas 12 horas): no se puede sugerir altura')
    return base
  }
  if (!unidadesPorCaja) avisos.push('Sin unidad de empaque en el maestro: calculado en unidades')

  // Lo ya comprometido de cada altura.
  const comprometido = new Map<string, number>()
  const sumar = (ubicacion: string, unidades: number) => {
    const k = claveUbicacion(ubicacion)
    comprometido.set(k, (comprometido.get(k) ?? 0) + unidades)
  }
  const [otrosPendientes, tareas] = await Promise.all([
    tx.pendienteGourmet.findMany({
      where: { plu: pendiente.plu, id: { not: pendiente.id }, deletedAt: null, estado: { in: ['ASIGNADO', 'EN_CURSO'] } },
      select: { sugerencia: true },
    }),
    tx.tareaResurtido.findMany({
      where: { plu: pendiente.plu, estado: { in: ['PENDIENTE', 'EN_CURSO'] }, montaje: { deletedAt: null } },
      select: { altura: true, unidadesSolicitadas: true, unidadesPendientes: true },
    }),
  ])
  for (const o of otrosPendientes) {
    const s = o.sugerencia as unknown as SugerenciaPendiente | null
    for (const a of s?.alturas ?? []) sumar(a.ubicacion, a.unidades)
  }
  for (const t of tareas) sumar(t.altura, t.unidadesSolicitadas + t.unidadesPendientes)

  const r = sugerirAlturas({ unidadesSolicitadas: pendiente.unidadesSolicitadas, unidadesPorCaja, filas, comprometido })
  if (!filas.some((f) => f.concepto === 'ALMACENAMIENTO')) avisos.push('El teórico no tiene alturas de este PLU')
  if (r.faltante > 0) avisos.push(`Reserva insuficiente según el teórico: faltan ${r.faltante} und`)
  return { ...base, unidadesSugeridas: r.unidadesSugeridas, alturas: r.alturas, faltante: r.faltante }
}

/** Texto corto para avisos: "Saca de 04-F-01 (1 caja · 6 und) → lleva a 02-B-02-01-10". */
export function textoSugerencia(s: SugerenciaPendiente | null): string {
  if (!s) return ''
  const desde = s.alturas.map((a) => `${a.ubicacion} (${a.cajas != null ? `${a.cajas} caja${a.cajas === 1 ? '' : 's'} · ` : ''}${a.unidades} und)`).join(' + ')
  const partes = []
  if (desde) partes.push(`Saca de ${desde}`)
  if (s.picking) partes.push(`lleva a ${s.picking}`)
  return partes.join(' → ')
}
