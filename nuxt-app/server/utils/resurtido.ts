// Capa Prisma del montaje de resurtido, las tareas y los pendientes.
//
// Lo puro vive en resurtidoCalc.ts (auto-importado por Nitro); aqui solo va lo
// que toca la base. Sin re-exportar nada de alli: duplicar el auto-import
// dispara los avisos de "Duplicated imports" de Nuxt.
import { createError } from 'h3'
import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from './prisma'
import { esEjecutor, esSolicitante, ROLES_ALMACENAMIENTO } from './resurtidoCalc'

type Tx = Prisma.TransactionClient | PrismaClient

/** Quien la tiene ahora y quien se la paso: la pantalla lo dice. */
export const TAREA_INCLUDE = {
  responsable: { select: { name: true } },
  pasadoPor: { select: { name: true } },
} as const

export const MONTAJE_INCLUDE = {
  operario: { select: { name: true } },
  creadoPor: { select: { name: true } },
  tareas: { orderBy: { orden: 'asc' }, include: TAREA_INCLUDE },
} as const

export const PENDIENTE_INCLUDE = {
  solicitadoPor: { select: { name: true } },
  asignadoPor: { select: { name: true } },
  operario: { select: { name: true } },
  devueltoPor: { select: { name: true } },
  novedadPor: { select: { name: true } },
  pasadoPor: { select: { name: true } },
} as const

export function puedeVerAlmacenamiento(role: string): boolean {
  return (ROLES_ALMACENAMIENTO as readonly string[]).includes(role)
}

/**
 * Montar un resurtido o asignar un pendiente es un permiso POR PERSONA
 * (users.puede_montar_resurtido), no por rol.
 *
 * Igual que el de cerrar novedades: hoy lo tienen Felipe Ossa y Eduardo Zurita,
 * y un supervisor que se cree manana no debe heredarlo solo por serlo. Se
 * consulta contra la base y no contra el token porque un ADMIN lo concede desde
 * Usuarios: leerlo del JWT lo dejaria obsoleto hasta el proximo inicio de sesion.
 */
export async function puedeMontarResurtido(usuarioId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { id: usuarioId },
    select: { puedeMontarResurtido: true },
  })
  return u?.puedeMontarResurtido === true
}

export async function assertPuedeMontar(usuarioId: string) {
  if (!(await puedeMontarResurtido(usuarioId))) {
    throw createError({
      statusCode: 403,
      statusMessage: 'No tienes permiso para montar resurtidos. Pideselo a un administrador.',
    })
  }
}

export function assertVeMontaje(role: string) {
  if (!puedeVerAlmacenamiento(role)) {
    throw createError({ statusCode: 403, statusMessage: 'Sin acceso a Montaje Resurtido' })
  }
}

/** Pendientes: los pide gourmet y los reparte almacenamiento. */
export function assertVePendientes(role: string) {
  if (!esSolicitante(role) && !puedeVerAlmacenamiento(role)) {
    throw createError({ statusCode: 403, statusMessage: 'Sin acceso a Pendientes' })
  }
}

export function assertEjecutor(role: string) {
  if (!esEjecutor(role)) {
    throw createError({ statusCode: 403, statusMessage: 'Solo los operarios ejecutan tareas' })
  }
}

/** Los usuarios a los que se les puede asignar una tarea. */
export async function listarOperarios() {
  const usuarios = await prisma.user.findMany({
    where: { active: true, role: { in: ['OPERARIO_ALMACENAMIENTO', 'MONTACARGAS'] } },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  })
  return usuarios.map((u) => ({ id: u.id, nombre: u.name, rol: u.role }))
}

/** Descripcion del maestro. Se copia al registro: si el maestro cambia despues,
 *  la tarea tiene que seguir diciendo lo que se mando a buscar. */
export async function descripcionMaestro(tx: Tx, plu: string): Promise<string | null> {
  const p = await tx.productoMaestro.findUnique({
    where: { plu },
    select: { descripcion: true },
  })
  return p?.descripcion ?? null
}

/**
 * Avisa dentro de la app. El aviso PERSISTE hasta que alguien lo abre: uno que
 * se pierde al recargar no sirve para enterarse de algo que paso mientras no
 * mirabas.
 */
export async function avisar(
  tx: Tx,
  destinatarios: readonly string[],
  aviso: { tipo: string; titulo: string; descripcion?: string | null; enlace?: string | null },
): Promise<void> {
  const ids = [...new Set(destinatarios)].filter(Boolean)
  if (ids.length === 0) return
  await tx.notificacion.createMany({
    data: ids.map((userId) => ({
      userId,
      tipo: aviso.tipo,
      titulo: aviso.titulo,
      descripcion: aviso.descripcion ?? null,
      enlace: aviso.enlace ?? null,
    })),
  })
}

// ── Tramos de un pendiente ─────────────────────────────────────────
// Igual que en montacargas: el tramo de cada persona se cierra al pasarlo y se
// abre el del siguiente en el mismo instante, asi el reloj no se corta.

/** Cierra el tramo abierto del pendiente, si lo hay. */
export async function cerrarTramoPendiente(tx: Tx, pendienteId: string, fin: Date): Promise<void> {
  await tx.tramoPendiente.updateMany({ where: { pendienteId, fin: null }, data: { fin } })
}

/** Abre el tramo de una persona, a continuacion de los que ya tenga el pendiente. */
export async function abrirTramoPendiente(tx: Tx, pendienteId: string, usuarioId: string, inicio: Date): Promise<void> {
  const orden = (await tx.tramoPendiente.count({ where: { pendienteId } })) + 1
  await tx.tramoPendiente.create({ data: { pendienteId, usuarioId, orden, inicio } })
}

// ── Tramos de una tarea de resurtido ───────────────────────────────
// Mismo mecanismo: pasarla a un ayudante cierra el tramo de quien la tenia y
// abre el del ayudante en el mismo instante.

/** Quien tiene la tarea en la mano: el ayudante al que se la pasaron o, si nadie
 *  la ha pasado, el operario del montaje. */
export function responsableDeTarea(t: { responsableId: string | null; montaje: { operarioId: string } }): string {
  return t.responsableId ?? t.montaje.operarioId
}

/** Cierra el tramo abierto de la tarea, si lo hay. */
export async function cerrarTramoTarea(tx: Tx, tareaId: string, fin: Date): Promise<void> {
  await tx.tramoTareaResurtido.updateMany({ where: { tareaId, fin: null }, data: { fin } })
}

/** Abre el tramo de una persona, a continuacion de los que ya tenga la tarea. */
export async function abrirTramoTarea(tx: Tx, tareaId: string, usuarioId: string, inicio: Date): Promise<void> {
  const orden = (await tx.tramoTareaResurtido.count({ where: { tareaId } })) + 1
  await tx.tramoTareaResurtido.create({ data: { tareaId, usuarioId, orden, inicio } })
}

/** Quienes deben enterarse de lo que pasa con los pendientes y los montajes. */
export async function idsAlmacenamiento(): Promise<string[]> {
  const us = await prisma.user.findMany({
    where: { active: true, puedeMontarResurtido: true },
    select: { id: true },
  })
  return us.map((u) => u.id)
}
