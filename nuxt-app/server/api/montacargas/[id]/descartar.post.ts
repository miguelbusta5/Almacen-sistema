import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { assertUsuarioMontacargas, cerrarTramoAbierto, esResponsableOGestor } from '../../../utils/montacargas'

const schema = z.object({ motivo: z.string().max(200).optional() })

// POST /api/montacargas/:id/descartar - el operario abandona el registro.
//
// Como el reloj arranca al digitar el PLU, un dedazo deja un registro corriendo.
// Sin esta salida cada error quedaria abierto para siempre inflando el promedio.
// Es borrado logico: queda en auditoria, fuera de reportes y KPIs.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioMontacargas(actor.role)

  const id = getRouterParam(event, 'id')!
  const parsed = schema.safeParse(await readBody(event).catch(() => ({})))
  const motivo = parsed.success ? parsed.data.motivo?.trim() : undefined

  const record = await prisma.movimientoMontacargas.findUnique({
    where: { id },
    select: { responsableId: true, estado: true, deletedAt: true, plu: true },
  })
  if (!record || record.deletedAt) {
    throw createError({ statusCode: 404, statusMessage: 'Registro no encontrado' })
  }
  if (!esResponsableOGestor(actor, record)) {
    throw createError({ statusCode: 403, statusMessage: 'El registro no esta en tus manos' })
  }
  if (record.estado === 'CERRADO') {
    throw createError({
      statusCode: 409,
      statusMessage: 'El registro ya esta cerrado: pide a supervision que lo elimine',
    })
  }

  const now = new Date()
  await prisma.$transaction(async (tx) => {
    await cerrarTramoAbierto(tx, id, now)
    await tx.movimientoMontacargas.update({
      where: { id },
      data: {
        deletedAt: now,
        actualizadoPorId: actor.id,
        motivoCorreccion: motivo || 'Descartado por el operario',
      },
    })
  })

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: 'DELETE',
      module: 'control-montacargas',
      recordId: id,
      details: `PLU ${record.plu} descartado: ${motivo || 'sin motivo'}`,
    },
  }).catch(() => {})

  return { success: true }
})
