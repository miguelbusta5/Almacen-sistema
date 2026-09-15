import { defineOperacionAlmacenHandler } from '../../../utils/operacionAlmacen'
import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapRecepcion } from '../../../utils/mapRow'
import { assertUsuarioRecepcion, esDuenoOGestor, RECEPCION_INCLUDE } from '../../../utils/recepcion'
import { validarCierre } from '../../../utils/recepcionCalc'

const schema = z.object({
  estibasUsadas: z.number().int(),
  referenciasNuevas: z.number().int(),
  unidadesNuevas: z.number().int(),
})

/**
 * POST /api/recepcion-contenedores/:id/cerrar - PARA EL RELOJ.
 *
 * Los datos del cierre solo se conocen cuando el contenedor ya esta abajo, por
 * eso no se piden al abrir: son el resultado de la descarga, no su plan.
 */
export default defineOperacionAlmacenHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioRecepcion(actor.role)

  const id = getRouterParam(event, 'id')!
  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const d = parsed.data

  const error = validarCierre(d)
  if (error) throw createError({ statusCode: 400, statusMessage: error })

  const record = await prisma.recepcionContenedor.findUnique({
    where: { id },
    select: { estado: true, deletedAt: true, creadoPorId: true, numeroPedido: true },
  })
  if (!record || record.deletedAt) {
    throw createError({ statusCode: 404, statusMessage: 'Recepcion no encontrada' })
  }
  if (!esDuenoOGestor(actor, record)) {
    throw createError({ statusCode: 403, statusMessage: 'Solo puedes cerrar las recepciones que abriste' })
  }
  if (record.estado === 'CERRADO') {
    throw createError({ statusCode: 409, statusMessage: 'Esta recepcion ya esta cerrada' })
  }

  const now = new Date()
  const updated = await prisma.recepcionContenedor.update({
    where: { id },
    data: {
      estado: 'CERRADO',
      horaFinalizacion: now,
      estibasUsadas: d.estibasUsadas,
      referenciasNuevas: d.referenciasNuevas,
      unidadesNuevas: d.unidadesNuevas,
      actualizadoPorId: actor.id,
    },
    include: RECEPCION_INCLUDE,
  })

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: 'UPDATE',
      module: 'recepcion-contenedores',
      recordId: id,
      details: `Contenedor ${record.numeroPedido} cerrado - ${d.estibasUsadas} estibas, `
        + `${d.referenciasNuevas} referencias nuevas`,
    },
  }).catch(() => {})

  return { success: true, data: mapRecepcion(updated) }
})
