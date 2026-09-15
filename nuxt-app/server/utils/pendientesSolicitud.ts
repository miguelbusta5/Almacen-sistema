import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'

type Db = Prisma.TransactionClient | typeof prisma

/** Minutos en los que un resurtido completado cuenta como "reciente". */
export const MINUTOS_RESURTIDO_RECIENTE = 120

/**
 * El pendiente al que se SUMA una nueva solicitud del mismo PLU, si lo hay.
 *
 * Se suma si nadie lo ha empezado: pedido (SOLICITADO) o asignado sin escanear.
 * Si ya va dentro de una tarea de resurtido, solo si esa tarea tampoco se ha
 * empezado (se le suman las unidades a la tarea). En curso, ubicado, devuelto
 * o con novedad: se crea uno nuevo. No importa quien lo pidio.
 */
export async function buscarPendienteSumable(db: Db, plu: string) {
  const candidatos = await db.pendienteGourmet.findMany({
    where: {
      plu, deletedAt: null, horaInicio: null,
      estado: { in: ['SOLICITADO', 'ASIGNADO'] },
    },
    orderBy: { solicitadoAt: 'asc' },
    select: {
      id: true, estado: true, unidadesSolicitadas: true, observacion: true, operarioId: true,
      descripcion: true, tareaResurtidoId: true,
      operario: { select: { name: true } },
      tareaResurtido: { select: { id: true, estado: true, horaInicio: true, unidadesPendientes: true } },
    },
  })
  return candidatos.find((p) => !p.tareaResurtidoId
    || (p.tareaResurtido && p.tareaResurtido.estado === 'PENDIENTE' && !p.tareaResurtido.horaInicio)) ?? null
}

/** Junta la observacion nueva con la anterior sin repetirla. */
export function unirObservaciones(anterior: string | null, nueva: string | null | undefined): string | null {
  const a = anterior?.trim() || ''
  const n = nueva?.trim() || ''
  if (!n || a.split(' · ').includes(n)) return a || null
  return a ? `${a} · ${n}` : n
}

/**
 * Lo que quien pide debe saber antes de pedir: si el PLU tiene un resurtido
 * abierto o se resurtio en las ultimas 2 horas.
 */
export async function resurtidoDelPlu(db: Db, plu: string, ahora = new Date()) {
  const desde = new Date(ahora.getTime() - MINUTOS_RESURTIDO_RECIENTE * 60 * 1000)
  const [abiertas, recientes] = await Promise.all([
    db.tareaResurtido.findMany({
      where: { plu, estado: { in: ['PENDIENTE', 'EN_CURSO'] }, montaje: { deletedAt: null, estado: 'EN_CURSO' } },
      select: {
        horaInicio: true, unidadesSolicitadas: true, unidadesPendientes: true, pickingSugerido: true,
        responsable: { select: { name: true } },
        montaje: { select: { operario: { select: { name: true } } } },
      },
    }),
    db.tareaResurtido.findMany({
      where: { plu, estado: 'COMPLETADA', horaFin: { gte: desde }, montaje: { deletedAt: null } },
      orderBy: { horaFin: 'desc' },
      select: {
        horaFin: true, unidadesBajadas: true, pickingFinal: true, pickingSugerido: true,
        responsable: { select: { name: true } },
        montaje: { select: { operario: { select: { name: true } } } },
      },
    }),
  ])
  return {
    enCurso: abiertas.map((t) => ({
      operarioNombre: t.responsable?.name ?? t.montaje.operario.name ?? null,
      unidades: t.unidadesSolicitadas + t.unidadesPendientes,
      iniciada: Boolean(t.horaInicio),
      picking: t.pickingSugerido,
    })),
    reciente: recientes.map((t) => ({
      operarioNombre: t.responsable?.name ?? t.montaje.operario.name ?? null,
      completadaAt: t.horaFin!.toISOString(),
      unidadesBajadas: t.unidadesBajadas,
      picking: t.pickingFinal ?? t.pickingSugerido,
    })),
  }
}
