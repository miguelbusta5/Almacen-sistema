// SERVER-ONLY. Capa Prisma de Control Montacargas y Resurtido: scope por rol,
// filtros del listado y resolución del producto contra el maestro.
// La lógica pura (validaciones, cálculo, estado) vive en montacargasCalc.ts.
//
// Sin re-exports de montacargasCalc a propósito: Nitro auto-importa todo lo que
// hay en server/utils, así que reexportar aquí lo que ya vive allí genera un
// "Duplicated imports" y el auto-import se queda con una de las dos al azar.
// Cada handler importa de su módulo real.
import { createError } from 'h3'
import { prisma } from './prisma'
import {
  normalizarCodigoProducto,
  pareceEan,
  puedeGestionarMontacargas,
  puedeUsarMontacargas,
  type TipoMovimiento,
} from './montacargasCalc'

export const MOVIMIENTO_INCLUDE = {
  creadoPor: { select: { name: true } },
  actualizadoPor: { select: { name: true } },
} as const

export function assertUsuarioMontacargas(role: string) {
  if (!puedeUsarMontacargas(role)) {
    throw createError({ statusCode: 403, statusMessage: 'Sin acceso a Control Montacargas' })
  }
}

export function assertGestorMontacargas(role: string, mensaje = 'No autorizado') {
  if (!puedeGestionarMontacargas(role)) {
    throw createError({ statusCode: 403, statusMessage: mensaje })
  }
}

/** Un MONTACARGAS solo ve lo suyo; los gestores ven todo (o filtran por operario). */
export function whereScopeMontacargas(
  actor: { id: string; role: string },
  usuarioId?: string,
): Record<string, unknown> {
  if (!puedeGestionarMontacargas(actor.role)) return { creadoPorId: actor.id }
  return usuarioId ? { creadoPorId: usuarioId } : {}
}

/**
 * Filtros compartidos por el listado, los conteos y el Excel.
 *
 * `tipo` NO es opcional: cada pestaña y cada módulo consulta lo suyo. Sin él,
 * Resurtido mostraría los movimientos de depósito y al revés.
 */
export function buildMovimientoWhere(
  actor: { id: string; role: string },
  tipo: TipoMovimiento,
  sp: { q?: string; fecha?: string; usuarioId?: string; estado?: string },
  opts: { scoped?: boolean } = {},
): Record<string, unknown> {
  const { q, fecha, usuarioId, estado } = sp
  return {
    tipo,
    deletedAt: null,
    ...(opts.scoped === false
      ? usuarioId
        ? { creadoPorId: usuarioId }
        : {}
      : whereScopeMontacargas(actor, usuarioId)),
    ...(fecha ? { fecha: new Date(`${fecha}T00:00:00.000Z`) } : {}),
    ...(estado === 'en-curso' ? { horaFinalizacion: null } : {}),
    ...(estado === 'cerrado' ? { horaFinalizacion: { not: null } } : {}),
    ...(q
      ? {
          OR: [
            { plu: { contains: q, mode: 'insensitive' } },
            { ean: { contains: q, mode: 'insensitive' } },
            { descripcion: { contains: q, mode: 'insensitive' } },
            { ubicacionInicial: { contains: q, mode: 'insensitive' } },
            { ubicacionFinal: { contains: q, mode: 'insensitive' } },
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
