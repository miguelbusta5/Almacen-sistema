import { defineOperacionAlmacenHandler } from '../../../../utils/operacionAlmacen'
import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../../utils/prisma'
import { requireAuth } from '../../../../utils/auth'
import { mapRecepcion } from '../../../../utils/mapRow'
import { assertUsuarioRecepcion, esDuenoOGestor, RECEPCION_INCLUDE } from '../../../../utils/recepcion'

// DELETE /api/recepcion-contenedores/:id/novedad/:novedadId - quita una linea
// mal digitada. Borrado real y no logico: es una linea de captura, no un
// historico; lo que interesa auditar es el reporte final.
export default defineOperacionAlmacenHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioRecepcion(actor.role)

  const id = getRouterParam(event, 'id')!
  const novedadId = getRouterParam(event, 'novedadId')!

  const record = await prisma.recepcionContenedor.findUnique({
    where: { id },
    select: { deletedAt: true, creadoPorId: true },
  })
  if (!record || record.deletedAt) {
    throw createError({ statusCode: 404, statusMessage: 'Recepcion no encontrada' })
  }
  if (!esDuenoOGestor(actor, record)) {
    throw createError({ statusCode: 403, statusMessage: 'No puedes tocar los reportes de otra persona' })
  }

  const borradas = await prisma.novedadRecepcion.deleteMany({
    where: { id: novedadId, recepcionId: id },
  })
  if (borradas.count === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Linea no encontrada' })
  }

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: 'DELETE',
      module: 'recepcion-contenedores',
      recordId: id,
      details: `Linea de novedad ${novedadId} eliminada`,
    },
  }).catch(() => {})

  const updated = await prisma.recepcionContenedor.findUniqueOrThrow({
    where: { id },
    include: RECEPCION_INCLUDE,
  })
  return { success: true, data: mapRecepcion(updated) }
})
