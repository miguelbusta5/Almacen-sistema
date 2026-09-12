import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../../utils/prisma'
import { requireRole } from '../../../../utils/auth'
import { ROLES_GESTION_MUEBLES } from '../../../../utils/mueblesCalc'
import { auditar } from '../../../../utils/muebles'
import { mapEquipoMuebles } from '../../../../utils/mapRow'

const schema = z.object({
  capacidadM3: z.number().positive().nullable().optional(),
  capacidadKg: z.number().positive().nullable().optional(),
  activo: z.boolean().optional(),
})

/**
 * PATCH /api/muebles-admin/equipos/:id - sobre todo para cargar la capacidad
 * cuando se mida el equipo. Es un dato de configuracion, no un cambio de codigo.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, ROLES_GESTION_MUEBLES)
  const id = getRouterParam(event, 'id')!

  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }

  const equipo = await prisma.equipoMuebles.findUnique({ where: { id } })
  if (!equipo) throw createError({ statusCode: 404, statusMessage: 'Equipo no encontrado' })

  const actualizado = await prisma.equipoMuebles.update({ where: { id }, data: parsed.data })

  await auditar(actor.id, 'UPDATE', 'picking-muebles', id, `Equipo ${equipo.codigo} actualizado`)

  return { success: true, data: mapEquipoMuebles(actualizado) }
})
