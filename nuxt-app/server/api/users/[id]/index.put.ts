import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import bcrypt from 'bcryptjs'
import { prisma } from '../../../utils/prisma'
import { requireRole } from '../../../utils/auth'
import { BCRYPT_ROUNDS, updateUserSchema } from '../../../utils/usuarios'

// PUT /api/users/:id — editar, cambiar rol, activar/desactivar o resetear
// contraseña. Solo ADMIN.
export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, ['ADMIN'])
  const id = getRouterParam(event, 'id')!

  const parsed = updateUserSchema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const d = parsed.data

  // Un ADMIN no puede desactivarse ni degradarse a sí mismo: es lo que evita
  // quedarse sin ningún administrador y bloquear la gestión de cuentas.
  if (id === actor.id && (d.active === false || (d.role && d.role !== 'ADMIN'))) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No puedes desactivar ni cambiar tu propio rol de administrador',
    })
  }

  const data: Record<string, unknown> = {}
  if (d.name !== undefined) data.name = d.name
  if (d.role !== undefined) data.role = d.role
  if (d.active !== undefined) data.active = d.active
  if (d.password) {
    data.password = await bcrypt.hash(d.password, BCRYPT_ROUNDS)
    // Un reseteo hecho por ADMIN también es temporal.
    data.mustChangePassword = true
  }

  const user = await prisma.user.update({
    where: { id },
    data: data as never,
    select: { id: true, email: true, name: true, role: true, active: true },
  })

  return { success: true, data: user }
})
