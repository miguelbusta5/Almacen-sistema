import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapPendiente } from '../../../utils/mapRow'
import { abrirTramoPendiente, assertEjecutor, PENDIENTE_INCLUDE } from '../../../utils/resurtido'
import { validarEscaneoPlu } from '../../../utils/resurtidoCalc'
import { normalizarUbicacion, validarUbicacion } from '../../../utils/montacargasCalc'

const schema = z.object({
  plu: z.string().min(1).max(100),
  // De donde se saca. Obligatoria para arrancar; si el reloj ya corre, no hace
  // falta volver a escanearla.
  ubicacionInicial: z.string().max(120).optional(),
})

/**
 * POST /api/pendientes/:id/iniciar - ARRANCA EL RELOJ, igual que un movimiento
 * de deposito: escaneando el PLU y la ubicacion inicial.
 *
 * Abre el tramo de quien lo empieza. Si despues se lo pasa a un ayudante, el
 * reloj sigue: se cierra su tramo y se abre el del ayudante (traspasar).
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
    select: {
      estado: true, deletedAt: true, operarioId: true, plu: true, horaInicio: true,
      tramos: { where: { fin: null }, select: { id: true } },
    },
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
  if (p.horaInicio) {
    const actualizado = await prisma.pendienteGourmet.update({
      where: { id }, data: { estado: 'EN_CURSO' }, include: PENDIENTE_INCLUDE,
    })
    return { success: true, data: mapPendiente(actualizado) }
  }

  const ubicacionInicial = normalizarUbicacion(parsed.data.ubicacionInicial ?? '')
  const errUbic = validarUbicacion(ubicacionInicial, 'La ubicación inicial')
  if (errUbic) throw createError({ statusCode: 400, statusMessage: errUbic })

  const now = new Date()
  const actualizado = await prisma.$transaction(async (tx) => {
    await tx.pendienteGourmet.update({
      where: { id },
      data: { estado: 'EN_CURSO', horaInicio: now, ubicacionInicial },
    })
    if (p.tramos.length === 0) await abrirTramoPendiente(tx, id, actor.id, now)
    return tx.pendienteGourmet.findUniqueOrThrow({ where: { id }, include: PENDIENTE_INCLUDE })
  })

  return { success: true, data: mapPendiente(actualizado) }
})
