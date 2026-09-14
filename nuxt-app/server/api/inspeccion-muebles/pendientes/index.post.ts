import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { auditar, requireInspeccion } from '../../../utils/muebles'
import { normalizePlu } from '../../../utils/exportacionesCalc'
import { mapPendienteMuebles } from '../../../utils/mapRow'

const schema = z.object({
  ordenId: z.string().min(1).nullable().optional(),
  plu: z.string().min(1).max(100),
  unidades: z.number().int().positive(),
  observacion: z.string().max(500).nullable().optional(),
  inspectorId: z.string().min(1),
})

/**
 * POST /api/inspeccion-muebles/pendientes - el inspector reporta un faltante.
 *
 * NO bloquea la orden: la inspeccion sigue con los demas PLU. El faltante es
 * trabajo de picking, y mezclarlo con el cierre de la orden dejaria al inspector
 * esperando a alguien que esta en otra parte del CEDI.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireInspeccion(event)

  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const d = parsed.data

  const inspector = await prisma.inspector.findFirst({
    where: { id: d.inspectorId, activo: true },
    select: { id: true, nombre: true },
  })
  if (!inspector) throw createError({ statusCode: 404, statusMessage: 'Inspector no encontrado' })

  const pendiente = await prisma.pendienteMuebles.create({
    data: {
      ordenId: d.ordenId ?? null,
      plu: normalizePlu(d.plu),
      unidades: d.unidades,
      observacion: d.observacion?.trim() || null,
      creadoPorInspectorId: inspector.id,
    },
    include: {
      orden: { select: { id: true, codigo: true } },
      creadoPorInspector: { select: { id: true, nombre: true } },
      asignadoA: { select: { id: true, name: true } },
      resueltoPor: { select: { id: true, name: true } },
    },
  })

  await auditar(
    actor.id, 'CREATE', 'inspeccion-muebles', pendiente.id,
    `Pendiente PLU ${pendiente.plu} x${d.unidades} reportado por ${inspector.nombre}`,
  )

  return { success: true, data: mapPendienteMuebles(pendiente) }
})
