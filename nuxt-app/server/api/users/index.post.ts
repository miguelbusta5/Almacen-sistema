import { defineEventHandler, readBody, setResponseStatus, createError } from 'h3'
import bcrypt from 'bcryptjs'
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { BCRYPT_ROUNDS, createUserSchema } from '../../utils/usuarios'

// POST /api/users — crear cuenta. Solo ADMIN.
export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])

  const parsed = createUserSchema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }

  // Los correos son insensibles a mayúsculas: se normaliza para que el unique de
  // la tabla no deje colar dos cuentas "iguales".
  const email = parsed.data.email.toLowerCase().trim()
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) throw createError({ statusCode: 400, statusMessage: 'Email ya registrado' })

  const { transportistaId, ...userData } = parsed.data
  if (userData.role === 'TRANSPORTISTA' && !transportistaId) {
    throw createError({ statusCode: 400, statusMessage: 'Selecciona el transportista a vincular' })
  }
  if (userData.role !== 'TRANSPORTISTA' && transportistaId) {
    throw createError({ statusCode: 400, statusMessage: 'Solo el rol Transportista puede vincularse a un conductor' })
  }

  if (transportistaId) {
    const transportista = await prisma.transportista.findFirst({
      where: { id: transportistaId, activo: true, userId: null, vehiculoId: { not: null } },
      select: { id: true },
    })
    if (!transportista) {
      throw createError({ statusCode: 400, statusMessage: 'Transportista no disponible o sin vehiculo asignado' })
    }
  }

  const hashed = await bcrypt.hash(parsed.data.password, BCRYPT_ROUNDS)
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      // Toda cuenta nueva nace con contraseña temporal: el layout del dashboard
      // obliga a cambiarla en el primer login.
      data: { ...userData, email, password: hashed, mustChangePassword: true },
      select: { id: true, email: true, name: true, role: true, active: true },
    })
    if (transportistaId) {
      await tx.transportista.update({ where: { id: transportistaId }, data: { userId: created.id } })
    }
    return created
  })

  setResponseStatus(event, 201)
  return { success: true, data: user }
})
