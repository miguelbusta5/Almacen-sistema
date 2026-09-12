import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../../utils/prisma'
import { requireRole } from '../../../../utils/auth'
import { ROLES_GESTION_MUEBLES } from '../../../../utils/mueblesCalc'
import { auditar } from '../../../../utils/muebles'

const schema = z.object({
  nombre: z.string().min(2).max(120).optional(),
  activo: z.boolean().optional(),
})

/**
 * PATCH /api/muebles-admin/inspectores/:id
 *
 * Se desactiva, nunca se borra: un inspector que se va sigue siendo el dueno de
 * los tiempos que registro.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, ROLES_GESTION_MUEBLES)
  const id = getRouterParam(event, 'id')!

  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }

  const existe = await prisma.inspector.findUnique({ where: { id } })
  if (!existe) throw createError({ statusCode: 404, statusMessage: 'Inspector no encontrado' })

  const data: { nombre?: string; activo?: boolean } = {}
  if (parsed.data.nombre != null) data.nombre = parsed.data.nombre.trim()
  if (parsed.data.activo != null) data.activo = parsed.data.activo

  const inspector = await prisma.inspector.update({ where: { id }, data })
  await auditar(actor.id, 'UPDATE', 'inspeccion-muebles', id, `Inspector ${inspector.nombre} actualizado`)

  return { success: true, data: inspector }
})
