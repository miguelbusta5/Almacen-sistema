import { defineEventHandler, readBody, createError, setResponseStatus } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireCan } from '../../utils/auth'
import { mapGuardado } from '../../utils/mapRow'

const createSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  documento: z.string().min(1, 'Documento requerido'),
  ubicacion: z.string().min(1, 'Ubicación requerida'),
  estado: z.enum(['PENDIENTE DESPACHO', 'DESPACHADO']).default('PENDIENTE DESPACHO'),
  tipo: z.enum(['COMUN', 'ECOMMERCE']).default('COMUN'),
  fechaDespacho: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  nota: z.string().nullable().optional(),
  ciudad: z.string().max(100).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const actor = await requireCan(event, 'create')
  const parsed = createSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  const d = parsed.data

  const clientId = 't' + Date.now() + Math.random().toString(36).slice(2, 6)
  const esDesp = d.estado === 'DESPACHADO'
  const row = await prisma.transporteGuardado.create({
    data: {
      client_id: clientId, fecha: new Date(d.fecha + 'T00:00:00'),
      documento: d.documento, ubicacion: d.ubicacion,
      estado: d.estado, tipo: d.tipo,
      fecha_despacho: esDesp && d.fechaDespacho ? new Date(d.fechaDespacho + 'T00:00:00') : null,
      nota: d.nota || null,
      ciudad: d.ciudad || null,
    },
  })
  await prisma.activityLog.create({
    data: { userId: actor.id, action: 'CREATE', module: 'transporte', recordId: clientId, details: `${d.documento} · ${d.ubicacion} · ${d.tipo}` },
  }).catch(() => {})

  setResponseStatus(event, 201)
  return { success: true, data: mapGuardado(row) }
})
