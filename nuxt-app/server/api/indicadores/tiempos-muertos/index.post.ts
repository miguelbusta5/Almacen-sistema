import { defineEventHandler, readBody, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { assertGestorMontacargas } from '../../../utils/montacargas'
import { MOTIVO_TIEMPO_MUERTO_LABEL, validarJustificacion, type MotivoTiempoMuerto } from '../../../utils/indicadoresCalc'

const MEDIDOS = ['MONTACARGAS', 'OPERARIO_ALMACENAMIENTO'] as const

interface Cuerpo {
  motivo?: unknown
  observacion?: unknown
  tramos?: { usuarioId: string; inicio: string; fin: string }[]
}

/**
 * POST /api/indicadores/tiempos-muertos
 * { motivo, observacion?, tramos: [{ usuarioId, inicio, fin }] }
 *
 * Justifica uno o varios tiempos muertos con el mismo motivo: el almuerzo de
 * todo el equipo se explica de una vez, no persona por persona.
 *
 * No borra lo anterior: si ese rato ya tenia justificacion, la nueva manda y la
 * vieja queda como historia (la cuenta en agregarTiemposMuertos se queda con la
 * mas reciente).
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertGestorMontacargas(actor.role, 'Solo supervision puede justificar tiempos muertos')

  const body = (await readBody<Cuerpo>(event)) ?? {}
  const error = validarJustificacion({ motivo: body.motivo, observacion: body.observacion, tramos: body.tramos })
  if (error) throw createError({ statusCode: 400, statusMessage: error })

  const motivo = body.motivo as MotivoTiempoMuerto
  const observacion = typeof body.observacion === 'string' && body.observacion.trim()
    ? body.observacion.trim()
    : null
  const tramos = body.tramos!

  // Solo se justifica el tiempo de quien se mide: un id cualquiera no puede
  // colarse en los indicadores.
  const ids = [...new Set(tramos.map((t) => t.usuarioId))]
  const validos = await prisma.user.count({ where: { id: { in: ids }, role: { in: [...MEDIDOS] } } })
  if (validos !== ids.length) {
    throw createError({ statusCode: 400, statusMessage: 'Hay un tiempo muerto de alguien que no es montacarguista ni operario' })
  }

  const creadas = await prisma.justificacionTiempoMuerto.createManyAndReturn({
    select: { id: true },
    data: tramos.map((t) => ({
      usuarioId: t.usuarioId,
      inicio: new Date(t.inicio),
      fin: new Date(t.fin),
      motivo,
      observacion,
      justificadoPorId: actor.id,
    })),
  })

  const count = creadas.length
  await prisma.activityLog.create({
    data: {
      userId: actor.id, action: 'CREATE', module: 'indicadores', recordId: creadas[0]!.id,
      details: `${count} tiempo${count !== 1 ? 's' : ''} muerto${count !== 1 ? 's' : ''} justificado${count !== 1 ? 's' : ''}: ${MOTIVO_TIEMPO_MUERTO_LABEL[motivo]}`,
    },
  }).catch(() => {})

  return { success: true, justificados: count }
})
