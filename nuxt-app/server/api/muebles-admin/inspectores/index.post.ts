import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireRole } from '../../../utils/auth'
import { ROLES_GESTION_MUEBLES } from '../../../utils/mueblesCalc'
import { auditar } from '../../../utils/muebles'

const schema = z.object({ nombre: z.string().min(2).max(120) })

/** POST /api/muebles-admin/inspectores - alta en el catalogo. Sin contrasena: */
/* el login del area es compartido y esto solo dice de quien es cada tiempo. */
export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, ROLES_GESTION_MUEBLES)

  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Escribe el nombre del inspector' })
  }
  const nombre = parsed.data.nombre.trim()

  const inspector = await prisma.inspector.create({ data: { nombre } })
  await auditar(actor.id, 'CREATE', 'inspeccion-muebles', inspector.id, `Inspector ${nombre} creado`)

  return { success: true, data: inspector }
})
