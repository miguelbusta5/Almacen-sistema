// SERVER-ONLY. Capa Prisma del módulo Estibas: scope por rol, filtros del
// listado y resolución del producto contra el maestro.
// La lógica pura (validaciones, cálculo, estado) vive en estibasCalc.ts.
import { createError } from 'h3'
import { prisma } from './prisma'
import {
  normalizarCodigoProducto,
  pareceEan,
  puedeGestionarEstibas,
  puedeUsarEstibas,
} from './estibasCalc'

// Sin re-exports de estibasCalc a propósito: Nitro auto-importa todo lo que hay
// en server/utils, así que reexportar aquí lo que ya vive allí genera un
// "Duplicated imports" y el auto-import se queda con una de las dos al azar.
// Cada handler importa de su módulo real.

export const ESTIBA_INCLUDE = {
  creadoPor: { select: { name: true } },
  actualizadoPor: { select: { name: true } },
} as const

export function assertUsuarioEstibas(role: string) {
  if (!puedeUsarEstibas(role)) {
    throw createError({ statusCode: 403, statusMessage: 'Sin acceso a Estibas' })
  }
}

export function assertGestorEstibas(role: string, mensaje = 'No autorizado') {
  if (!puedeGestionarEstibas(role)) {
    throw createError({ statusCode: 403, statusMessage: mensaje })
  }
}

/** Un MONTACARGAS solo ve lo suyo; los gestores ven todo (o filtran por operario). */
export function whereScopeEstibas(
  actor: { id: string; role: string },
  usuarioId?: string,
): Record<string, unknown> {
  if (!puedeGestionarEstibas(actor.role)) return { creadoPorId: actor.id }
  return usuarioId ? { creadoPorId: usuarioId } : {}
}

/** Filtros compartidos por el listado, los conteos y el Excel. */
export function buildEstibaWhere(
  actor: { id: string; role: string },
  sp: { q?: string; fecha?: string; usuarioId?: string; estado?: string; pedido?: string },
  opts: { scoped?: boolean } = {},
): Record<string, unknown> {
  const { q, fecha, usuarioId, estado, pedido } = sp
  return {
    deletedAt: null,
    ...(opts.scoped === false
      ? usuarioId
        ? { creadoPorId: usuarioId }
        : {}
      : whereScopeEstibas(actor, usuarioId)),
    ...(fecha ? { fecha: new Date(`${fecha}T00:00:00.000Z`) } : {}),
    ...(pedido ? { pedido } : {}),
    ...(estado === 'en-curso' ? { horaFinalizacion: null } : {}),
    ...(estado === 'cerrada' ? { horaFinalizacion: { not: null } } : {}),
    ...(q
      ? {
          OR: [
            { pedido: { contains: q, mode: 'insensitive' } },
            { plu: { contains: q, mode: 'insensitive' } },
            { ean: { contains: q, mode: 'insensitive' } },
            { descripcion: { contains: q, mode: 'insensitive' } },
            { ubicacion: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  }
}

export interface ProductoResuelto {
  plu: string
  ean: string | null
  descripcion: string | null
  unidadesPorCaja: number | null
}

/**
 * Resuelve un producto del maestro a partir de lo que se capturó, que puede ser
 * el PLU o el EAN: la pistola del montacarguista lee el código de barras, pero
 * la planilla histórica se llevaba por PLU y algunos productos se teclean.
 * Se prueba primero la vía más probable según la forma del código.
 */
export async function resolverProducto(codigoCrudo: string): Promise<ProductoResuelto | null> {
  const codigo = normalizarCodigoProducto(codigoCrudo)
  if (!codigo) return null

  const select = { plu: true, ean: true, descripcion: true, unidadesPorCaja: true }

  const porPlu = () => prisma.productoMaestro.findUnique({ where: { plu: codigo }, select })
  // findFirst y no findUnique: el EAN no es único en el maestro (hay productos
  // que comparten código de barras entre variantes).
  const porEan = () => prisma.productoMaestro.findFirst({ where: { ean: codigo }, select })

  const [primero, segundo] = pareceEan(codigo) ? [porEan, porPlu] : [porPlu, porEan]
  return (await primero()) ?? (await segundo())
}
