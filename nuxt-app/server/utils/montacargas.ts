// SERVER-ONLY. Capa Prisma de Control Montacargas y Resurtido: scope por rol,
// filtros del listado, resolución del producto y manejo de tramos de tiempo.
// La lógica pura (validaciones, cálculo, estados) vive en montacargasCalc.ts.
//
// Sin re-exports de montacargasCalc a propósito: Nitro auto-importa todo lo que
// hay en server/utils, así que reexportar aquí lo que ya vive allí genera un
// "Duplicated imports" y el auto-import se queda con una de las dos al azar.
// Cada handler importa de su módulo real.
import { createError } from 'h3'
import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from './prisma'
import {
  normalizarCodigoProducto,
  pareceEan,
  puedeGestionarMontacargas,
  puedeUsarMontacargas,
  ROLES_RECEPTORES,
  type TipoMovimiento,
} from './montacargasCalc'

export const MOVIMIENTO_INCLUDE = {
  creadoPor: { select: { name: true } },
  responsable: { select: { name: true } },
  actualizadoPor: { select: { name: true } },
  tramos: {
    orderBy: { orden: 'asc' },
    include: { usuario: { select: { name: true } } },
  },
  novedades: {
    orderBy: { abiertaAt: 'desc' },
    include: {
      abiertaPor: { select: { name: true } },
      resueltaPor: { select: { name: true } },
    },
  },
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

/**
 * Cerrar una novedad es dar por buena una diferencia de inventario, asi que es
 * un permiso POR PERSONA (users.puede_resolver_novedades) y no por rol: atarlo
 * al rol se lo daria en silencio a cualquier supervisor que se cree despues.
 *
 * Se consulta contra la base y no contra el token porque un ADMIN lo concede y
 * lo quita desde Usuarios: leerlo del JWT lo dejaria obsoleto hasta el proximo
 * inicio de sesion.
 */
export async function puedeResolverNovedades(usuarioId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { id: usuarioId },
    select: { puedeResolverNovedades: true },
  })
  return u?.puedeResolverNovedades === true
}

export async function assertPuedeResolverNovedades(usuarioId: string) {
  if (!(await puedeResolverNovedades(usuarioId))) {
    throw createError({
      statusCode: 403,
      statusMessage: 'No tienes permiso para cerrar novedades. Pideselo a un administrador.',
    })
  }
}

/**
 * Alcance del listado.
 *
 * Gestión ve todo. El resto ve lo que tiene en la mano AHORA (responsableId), no
 * lo que creó: tras un traspaso el registro deja de ser problema del primero y
 * pasa a la bandeja del ayudante.
 */
export function whereScopeMontacargas(
  actor: { id: string; role: string },
  usuarioId?: string,
): Record<string, unknown> {
  if (!puedeGestionarMontacargas(actor.role)) return { responsableId: actor.id }
  return usuarioId ? { responsableId: usuarioId } : {}
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
        ? { responsableId: usuarioId }
        : {}
      : whereScopeMontacargas(actor, usuarioId)),
    ...(fecha ? { fecha: new Date(`${fecha}T00:00:00.000Z`) } : {}),
    ...(estado === 'en-curso' ? { estado: 'EN_CURSO' } : {}),
    ...(estado === 'novedad' ? { estado: 'NOVEDAD' } : {}),
    ...(estado === 'cerrado' ? { estado: 'CERRADO' } : {}),
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

// ── Tramos de tiempo ─────────────────────────────────────────────────
type Tx = Prisma.TransactionClient | PrismaClient

/**
 * Cierra el tramo abierto del registro. Devuelve el orden del último tramo.
 *
 * Se llama al traspasar, al abrir una novedad y al cerrar: son los tres momentos
 * en los que alguien deja de tener el PLU en la mano.
 */
export async function cerrarTramoAbierto(tx: Tx, movimientoId: string, fin: Date): Promise<number> {
  const abierto = await tx.tramoMontacargas.findFirst({
    where: { movimientoId, fin: null },
    orderBy: { orden: 'desc' },
  })
  if (!abierto) {
    const ultimo = await tx.tramoMontacargas.findFirst({
      where: { movimientoId },
      orderBy: { orden: 'desc' },
      select: { orden: true },
    })
    return ultimo?.orden ?? 0
  }
  await tx.tramoMontacargas.update({ where: { id: abierto.id }, data: { fin } })
  return abierto.orden
}

/** Abre un tramo nuevo para quien toma el PLU (traspaso o reanudación). */
export async function abrirTramo(
  tx: Tx,
  movimientoId: string,
  usuarioId: string,
  inicio: Date,
  orden: number,
): Promise<void> {
  await tx.tramoMontacargas.create({
    data: { movimientoId, usuarioId, inicio, orden },
  })
}

/**
 * Ayudantes disponibles con su carga pendiente, para que el operario reparta con
 * criterio en vez de a ciegas.
 */
export async function listarAyudantes(excluirId?: string): Promise<
  { id: string; nombre: string; rol: string; pendientes: number }[]
> {
  const usuarios = await prisma.user.findMany({
    // Los montacarguistas tambien entran: cuando hace falta hacen de ayudantes.
    // Gestion no, porque supervisar no es almacenar.
    where: {
      active: true,
      role: { in: [...ROLES_RECEPTORES] },
      // Uno no se pasa el PLU a si mismo, y verse en la lista solo estorba.
      ...(excluirId && { id: { not: excluirId } }),
    },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  })
  if (usuarios.length === 0) return []

  const cargas = await prisma.movimientoMontacargas.groupBy({
    by: ['responsableId'],
    where: {
      responsableId: { in: usuarios.map((u) => u.id) },
      estado: { in: ['EN_CURSO', 'NOVEDAD'] },
      deletedAt: null,
    },
    _count: { _all: true },
  })
  const porUsuario = new Map(cargas.map((c) => [c.responsableId, c._count._all]))

  return usuarios.map((u) => ({
    id: u.id,
    nombre: u.name,
    rol: u.role,
    pendientes: porUsuario.get(u.id) ?? 0,
  }))
}

/** ¿Este actor puede tomar/soltar este registro? Dueño actual o gestión. */
export function esResponsableOGestor(
  actor: { id: string; role: string },
  movimiento: { responsableId: string },
): boolean {
  return movimiento.responsableId === actor.id || puedeGestionarMontacargas(actor.role)
}

