import { defineEventHandler, readBody, getRouterParam, createError, setResponseStatus } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'

const schema = z.object({
  tipo: z.enum(['LLAMADA', 'MENSAJE', 'EMAIL', 'VISITA', 'ESCALACION']),
  resultado: z.enum(['NO_CONTESTA', 'CONFIRMO_FECHA', 'CANCELO', 'ESCALADO', 'OTRO']),
  fechaCompromiso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  nota: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  const clientId = getRouterParam(event, 'clientId')!
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  const d = parsed.data

  const row = await prisma.contactoGuardado.create({
    data: {
      guardadoClientId: clientId,
      tipo: d.tipo,
      resultado: d.resultado,
      fechaCompromiso: d.fechaCompromiso ? new Date(d.fechaCompromiso + 'T00:00:00') : null,
      nota: d.nota ?? null,
      registradoPor: actor.id,
    },
    include: { registradoPorUser: { select: { name: true } } },
  })

  if (d.resultado === 'CONFIRMO_FECHA' && d.fechaCompromiso) {
    await prisma.transporteGuardado.updateMany({
      where: { client_id: clientId },
      data: { nota: d.fechaCompromiso, updated_at: new Date() },
    }).catch(() => {})
  }
  await prisma.activityLog.create({
    data: { userId: actor.id, action: 'UPDATE', module: 'transporte', recordId: clientId, details: `Contacto: ${d.tipo} → ${d.resultado}` },
  }).catch(() => {})

  setResponseStatus(event, 201)
  return { success: true, data: row }
})
