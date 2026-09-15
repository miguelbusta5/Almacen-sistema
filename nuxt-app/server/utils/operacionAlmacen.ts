import { createError, defineEventHandler, getRouterParam, readBody, type H3Event } from 'h3'
import { requireAuth } from './auth'
import { prisma, prismaBase } from './prisma'
import { operacionContext } from './operacionContext'

const mensaje = 'Finaliza la pausa de alimentación o cambio de baterías para continuar'

export async function assertSinPausa(usuarioId: string | null | undefined) {
  if (!usuarioId) return
  if (await prisma.pausaOperativa.findUnique({ where: { activaUsuarioId: usuarioId } })) {
    throw createError({ statusCode: 409, statusMessage: mensaje })
  }
}

async function comprobarRegistro(event: H3Event) {
  const id = getRouterParam(event, 'id')
  if (!id) return
  const path = event.path.split('?')[0]!
  let registro: { pausaId: string | null } | null = null
  if (path.includes('/montacargas/')) {
    registro = await prisma.movimientoMontacargas.findUnique({ where: { id }, select: { pausaId: true } })
  } else if (path.includes('/resurtido-tareas/')) {
    registro = await prisma.tareaResurtido.findUnique({ where: { id }, select: { pausaId: true } })
  } else if (path.includes('/recepcion-contenedores/')) {
    registro = await prisma.recepcionContenedor.findUnique({ where: { id }, select: { pausaId: true } })
  } else if (path.includes('/pendientes/')) {
    const pendiente = await prisma.pendienteGourmet.findUnique({ where: { id }, select: { pausaId: true, tareaResurtido: { select: { pausaId: true } } } })
    registro = pendiente?.tareaResurtido?.pausaId ? pendiente.tareaResurtido : pendiente
  } else if (path.includes('/montaje-resurtido/')) {
    registro = await prisma.tareaResurtido.findFirst({ where: { montajeId: id, pausaId: { not: null } }, select: { pausaId: true } })
  }
  if (registro?.pausaId) throw createError({ statusCode: 409, statusMessage: 'Este registro está en pausa. Su responsable debe finalizarla para continuar' })
}

/**
 * Una única transacción para cada escritura de estos flujos. El bloqueo de
 * PostgreSQL ordena pausa/cierre/traspaso incluso entre instancias de Vercel.
 * Sin él una petición iniciada justo antes de la pausa podría abrir un tramo
 * después. Los GET y el resto de módulos no toman este bloqueo.
 */
export function defineOperacionAlmacenHandler<T>(handler: (event: H3Event) => Promise<T>, permitePausa = false) {
  return defineEventHandler(async (event) => {
    const actor = await requireAuth(event)
    // Leer fuera de la transacción: no retener un bloqueo esperando la red.
    const body = await readBody(event).catch(() => null)
    return prismaBase.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(71420914)`
      return operacionContext.run(tx, async () => {
        if (!permitePausa) {
          await assertSinPausa(actor.id)
          await comprobarRegistro(event)
          // Los traspasos y asignaciones tampoco abren relojes a alguien que
          // está alimentándose. La validación específica sigue en cada handler.
          for (const key of ['operarioId', 'ayudanteId', 'responsableId']) {
            if (typeof body?.[key] === 'string') await assertSinPausa(body[key])
          }
        }
        return handler(event)
      })
    }, { maxWait: 15000, timeout: 30000 })
  })
}
