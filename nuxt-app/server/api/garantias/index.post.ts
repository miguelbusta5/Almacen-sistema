import { createError, defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { auditarGarantia, INCLUDE_GARANTIA, mapGarantia } from '../../utils/garantias'
import { necesitaCaso, TIPOS_GARANTIA } from '../../utils/garantiasCalc'

const schema = z.object({
  tipo: z.enum(TIPOS_GARANTIA),
  numeroCaso: z.string().max(100).optional(),
  observacion: z.string().max(1000).optional(),
  plu: z.string().min(1).max(100),
  descripcion: z.string().max(500).optional(),
})

export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, ['GARANTIAS'])
  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Revisa los campos de la tarea' })
  const d = parsed.data
  const numeroCaso = d.numeroCaso?.trim() || null
  const observacion = d.observacion?.trim() || null
  const plu = d.plu.trim().toUpperCase()
  if (!plu || (necesitaCaso(d.tipo) && !numeroCaso) || (d.tipo === 'OTRAS' && !observacion)) {
    throw createError({ statusCode: 400, statusMessage: 'Completa PLU, caso u observación según el tipo de tarea' })
  }
  const producto = await prisma.productoMaestro.findUnique({ where: { plu }, select: { descripcion: true, fabricante: true } })
  const descripcion = producto?.descripcion?.trim() || d.descripcion?.trim()
  if (!descripcion) throw createError({ statusCode: 400, statusMessage: 'Escribe la descripción de este PLU' })
  const ahora = new Date()
  const tarea = await prisma.tareaGarantia.create({
    data: {
      usuarioId: actor.id, tipo: d.tipo, numeroCaso, observacion, plu, descripcion,
      proveedor: producto?.fabricante?.trim() || 'Sin proveedor', horaInicio: ahora,
      tramos: { create: { inicio: ahora } },
    },
    include: INCLUDE_GARANTIA,
  })
  await auditarGarantia(actor.id, 'CREATE', tarea.id, `Inició ${d.tipo} · caso ${numeroCaso ?? 'sin caso'} · PLU ${plu}`)
  return { data: mapGarantia(tarea, false) }
})
