import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { auditarCargue, requireCargue } from '../../../utils/cargueCamion'
import { normalizarTextoCargue } from '../../../utils/cargueCamionCalc'

const schema = z.object({ nombre: z.string().max(120).optional(), activo: z.boolean().optional() })

/**
 * PATCH /api/cargue-camiones/operarios/:id - corrige el nombre o activa /
 * desactiva. No se borra: los camiones ya cargados lo siguen nombrando.
 * Solo ADMIN.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireCargue(event)
  if (actor.role !== 'ADMIN') throw createError({ statusCode: 403, statusMessage: 'Solo el administrador edita la lista de quienes cargan' })
  const id = getRouterParam(event, 'id')!
  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  const actual = await prisma.operarioCargue.findUnique({ where: { id } })
  if (!actual) throw createError({ statusCode: 404, statusMessage: 'Persona no encontrada' })

  const nombre = parsed.data.nombre != null ? normalizarTextoCargue(parsed.data.nombre) : undefined
  if (nombre != null && nombre.length < 3) throw createError({ statusCode: 400, statusMessage: 'Escribe el nombre completo' })
  const actualizado = await prisma.operarioCargue.update({
    where: { id },
    data: { ...(nombre != null && { nombre }), ...(parsed.data.activo != null && { activo: parsed.data.activo }) },
    select: { id: true, nombre: true, activo: true },
  })
  await auditarCargue(actor.id, 'UPDATE', id,
    `Operario de cargue ${actual.nombre}: ${nombre && nombre !== actual.nombre ? `ahora ${nombre}` : ''}${parsed.data.activo != null ? (parsed.data.activo ? ' activo' : ' inactivo') : ''}`.trim())
  return { success: true, data: actualizado }
})
