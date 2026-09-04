import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapEstiba } from '../../../utils/mapRow'
import { assertUsuarioEstibas, ESTIBA_INCLUDE } from '../../../utils/estibas'
import { normalizarUbicacion, validarUbicacion } from '../../../utils/estibasCalc'

const schema = z.object({ ubicacion: z.string().min(1).max(120) })

// POST /api/estibas/:id/ubicacion — asigna el depósito final y PARA EL RELOJ.
// Asignar la ubicación es lo que cierra la estiba: no hay un "finalizar" aparte.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioEstibas(actor.role)

  const id = getRouterParam(event, 'id')!
  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }

  const ubicacion = normalizarUbicacion(parsed.data.ubicacion)
  const validation = validarUbicacion(ubicacion)
  if (validation) throw createError({ statusCode: 400, statusMessage: validation })

  const record = await prisma.estiba.findUnique({
    where: { id },
    select: { creadoPorId: true, horaFinalizacion: true, deletedAt: true },
  })
  if (!record || record.deletedAt) throw createError({ statusCode: 404, statusMessage: 'Estiba no encontrada' })
  if (record.creadoPorId !== actor.id) {
    throw createError({ statusCode: 403, statusMessage: 'Solo puedes cerrar tus propias estibas' })
  }
  if (record.horaFinalizacion) {
    throw createError({ statusCode: 409, statusMessage: 'La estiba ya está cerrada' })
  }

  const updated = await prisma.estiba.update({
    where: { id },
    data: { ubicacion, horaFinalizacion: new Date(), actualizadoPorId: actor.id },
    include: ESTIBA_INCLUDE,
  })

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: 'UPDATE',
      module: 'estibas',
      recordId: id,
      details: `Ubicación asignada: ${ubicacion}`,
    },
  }).catch(() => {})

  return { success: true, data: mapEstiba(updated) }
})
