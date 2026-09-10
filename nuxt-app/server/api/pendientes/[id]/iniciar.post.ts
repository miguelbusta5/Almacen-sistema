import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapPendiente } from '../../../utils/mapRow'
import { assertEjecutor, PENDIENTE_INCLUDE } from '../../../utils/resurtido'
import { validarEscaneoPlu } from '../../../utils/resurtidoCalc'

const schema = z.object({ plu: z.string().min(1).max(100) })

/**
 * POST /api/pendientes/:id/iniciar - ARRANCA EL RELOJ, igual que un movimiento
 * de deposito: escaneando el PLU.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertEjecutor(actor.role)

  const id = getRouterParam(event, 'id')!
  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }

  const p = await prisma.pendienteGourmet.findUnique({
    where: { id },
    select: { estado: true, deletedAt: true, operarioId: true, plu: true, horaInicio: true },
  })
  if (!p || p.deletedAt) throw createError({ statusCode: 404, statusMessage: 'Pendiente no encontrado' })
  if (p.operarioId !== actor.id) {
    throw createError({ statusCode: 403, statusMessage: 'Ese pendiente es de otro operario' })
  }
  if (p.estado === 'COMPLETADO') {
    throw createError({ statusCode: 409, statusMessage: 'Ese pendiente ya se ubico' })
  }

  const error = validarEscaneoPlu(parsed.data.plu, p.plu)
  if (error) throw createError({ statusCode: 400, statusMessage: error })

  // Volver a escanear no reinicia el reloj.
  const actualizado = await prisma.pendienteGourmet.update({
    where: { id },
    data: { estado: 'EN_CURSO', ...(p.horaInicio ? {} : { horaInicio: new Date() }) },
    include: PENDIENTE_INCLUDE,
  })

  return { success: true, data: mapPendiente(actualizado) }
})
