// Capa Prisma de Recepcion de Contenedores.
//
// Lo puro vive en recepcionCalc.ts (auto-importado por Nitro); aqui solo va lo
// que toca la base. Sin re-exportar nada de alli: duplicar el auto-import
// dispara los avisos de "Duplicated imports" de Nuxt.
import { createError } from 'h3'
import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from './prisma'
import { puedeGestionarRecepcion, puedeUsarRecepcion } from './recepcionCalc'
import { medidasDePlus } from './carga'
import { cargaDeUnidades } from './cargaCalc'
import {
  almacenamientoContenedor, asignarMovimientos,
  type AlmacenamientoContenedor, type MovimientoAlm, type RecepcionAlm,
} from './recepcionAlmacenamientoCalc'

type Tx = Prisma.TransactionClient | PrismaClient

export const RECEPCION_INCLUDE = {
  creadoPor: { select: { name: true } },
  actualizadoPor: { select: { name: true } },
  descargadores: {
    include: { usuario: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  },
  novedades: {
    orderBy: { createdAt: 'desc' },
    include: { creadoPor: { select: { name: true } } },
  },
} as const

export function assertUsuarioRecepcion(role: string) {
  if (!puedeUsarRecepcion(role)) {
    throw createError({ statusCode: 403, statusMessage: 'Sin acceso a Recepcion de Contenedores' })
  }
}

export function assertGestorRecepcion(role: string, mensaje = 'No autorizado') {
  if (!puedeGestionarRecepcion(role)) {
    throw createError({ statusCode: 403, statusMessage: mensaje })
  }
}

/**
 * Quien abrio la planilla la cierra; supervision puede sobre cualquiera.
 *
 * Se compara contra creadoPorId y no contra un "responsable": una recepcion no
 * cambia de manos, la lleva de principio a fin quien la abrio.
 */
export function esDuenoOGestor(
  actor: { id: string; role: string },
  record: { creadoPorId: string },
): boolean {
  return record.creadoPorId === actor.id || puedeGestionarRecepcion(actor.role)
}

/**
 * Alcance de datos: el operario ve lo suyo, supervision lo ve todo.
 *
 * Mismo criterio que Control Montacargas — el operario no tiene por que ver el
 * rendimiento de sus companeros.
 */
export function whereScopeRecepcion(actor: { id: string; role: string }): Prisma.RecepcionContenedorWhereInput {
  return puedeGestionarRecepcion(actor.role) ? {} : { creadoPorId: actor.id }
}

/**
 * Busca la descripcion de un PLU en el maestro.
 *
 * La descripcion se COPIA a la novedad en vez de leerse por join: si el maestro
 * cambia despues, el reporte tiene que seguir diciendo lo que se vio ese dia.
 */
export async function descripcionDePlu(tx: Tx, plu: string): Promise<string | null> {
  const p = await tx.productoMaestro.findUnique({
    where: { plu },
    select: { descripcion: true },
  })
  return p?.descripcion ?? null
}

/** Los usuarios que pueden aparecer como personas descargando. */
export async function listarDescargadores() {
  return prisma.user.findMany({
    where: {
      active: true,
      role: { in: ['MONTACARGAS', 'OPERARIO_ALMACENAMIENTO'] },
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  })
}

/** Reemplaza la lista de descargadores de una recepcion. */
export async function fijarDescargadores(
  tx: Tx,
  recepcionId: string,
  usuarioIds: readonly string[],
): Promise<void> {
  await tx.descargadorRecepcion.deleteMany({ where: { recepcionId } })
  if (usuarioIds.length === 0) return
  await tx.descargadorRecepcion.createMany({
    data: [...new Set(usuarioIds)].map((usuarioId) => ({ recepcionId, usuarioId })),
    skipDuplicates: true,
  })
}

/**
 * El almacenamiento de cada recepcion: los PLU que el montacarguista recibio
 * en Control Montacargas con el mismo numero de pedido (desde el 24-09), con
 * sus m3, unidades y tiempo. Ver recepcionAlmacenamientoCalc.ts.
 *
 * Trae TODAS las recepciones de esos pedidos (no solo las pedidas) para
 * repartir bien los PLU cuando un pedido llega en dos contenedores.
 */
export async function almacenamientoDeRecepciones(
  recs: ReadonlyArray<{ numeroPedido: string }>,
): Promise<{ porRecepcion: Map<string, AlmacenamientoContenedor>; sinContenedor: MovimientoAlm[] }> {
  const pedidos = [...new Set(recs.map((x) => x.numeroPedido).filter(Boolean))]
  if (!pedidos.length) return { porRecepcion: new Map(), sinContenedor: [] }

  const [todas, movs] = await Promise.all([
    prisma.recepcionContenedor.findMany({
      where: { deletedAt: null, numeroPedido: { in: pedidos } },
      select: {
        id: true, numeroPedido: true, tipoContenedor: true, estado: true,
        horaInicio: true, horaFinalizacion: true, pausaSegundos: true,
      },
    }),
    prisma.movimientoMontacargas.findMany({
      where: { deletedAt: null, tipo: 'RECEPCION', numeroPedido: { in: pedidos } },
      select: {
        id: true, numeroPedido: true, plu: true, cantidadTotal: true, estado: true,
        horaInicio: true, horaFinalizacion: true,
        tramos: { select: { usuarioId: true, inicio: true, fin: true } },
      },
    }),
  ])
  const medidas = await medidasDePlus(movs.map((m) => m.plu))
  const entrada: MovimientoAlm[] = movs.map((m) => {
    const carga = cargaDeUnidades(m.cantidadTotal, medidas.get(m.plu))
    return { ...m, numeroPedido: m.numeroPedido!, m3: carga.m3, kg: carga.kg }
  })
  const recAlm: RecepcionAlm[] = todas.map((x) => ({ ...x, pausaSegundos: x.pausaSegundos ?? 0 }))
  const { porRecepcion, sinContenedor } = asignarMovimientos(recAlm, entrada)
  return {
    porRecepcion: new Map(recAlm.map((x) => [x.id, almacenamientoContenedor(x, porRecepcion.get(x.id) ?? [])])),
    sinContenedor,
  }
}
