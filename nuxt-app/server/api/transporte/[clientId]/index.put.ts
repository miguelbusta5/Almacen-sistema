import { defineEventHandler, readBody, getRouterParam, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireCan } from '../../../utils/auth'

const updateSchema = z.object({
  ubicacion: z.string().min(1).optional(),
  estado: z.enum(['PENDIENTE DESPACHO', 'DESPACHADO']).optional(),
  tipo: z.enum(['COMUN', 'ECOMMERCE']).optional(),
  fechaDespacho: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  nota: z.string().nullable().optional(),
  ciudad: z.string().max(100).nullable().optional(),
  netsuiteId: z.string().max(100).nullable().optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export default defineEventHandler(async (event) => {
  const actor = await requireCan(event, 'edit')
  const clientId = getRouterParam(event, 'clientId')!
  const parsed = updateSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  const d = parsed.data
  const esDesp = d.estado === 'DESPACHADO'

  if (d.fecha !== undefined && actor.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Solo el administrador puede modificar la fecha de ingreso' })
  }

  const row = await prisma.transporteGuardado.update({
    where: { client_id: clientId },
    data: {
      ...(d.fecha !== undefined && { fecha: new Date(d.fecha + 'T00:00:00') }),
      ...(d.ubicacion !== undefined && { ubicacion: d.ubicacion }),
      ...(d.estado !== undefined && { estado: d.estado }),
      ...(d.tipo !== undefined && { tipo: d.tipo }),
      fecha_despacho: esDesp
        ? new Date((d.fechaDespacho || new Date().toISOString().slice(0, 10)) + 'T00:00:00')
        : d.estado === 'PENDIENTE DESPACHO' ? null : undefined,
      ...(d.nota !== undefined && { nota: d.nota }),
      ...(d.ciudad !== undefined && { ciudad: d.ciudad }),
      ...(d.netsuiteId !== undefined && { netsuiteId: d.netsuiteId }),
      updated_at: new Date(),
    },
  })
  await prisma.activityLog.create({
    data: { userId: actor.id, action: 'UPDATE', module: 'transporte', recordId: clientId, details: `Estado: ${row.estado}` },
  }).catch(() => {})

  return { success: true }
})
