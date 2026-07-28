import { defineEventHandler, readBody, setResponseStatus, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireRole } from '../../../utils/auth'
import { getErrorCode } from '../../../utils/errors'
import { vehiculoSchema } from '../../../utils/usuarios'

// POST /api/users/vehiculos — alta de vehículo. Solo ADMIN.
export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])

  const parsed = vehiculoSchema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const d = parsed.data

  try {
    const vehiculo = await prisma.vehiculo.create({
      data: {
        placa: d.placa.trim().toUpperCase(),
        tipo: d.tipo.trim().toUpperCase(),
        capacidadKg: d.capacidadKg ?? null,
        estado: d.estado,
      },
      select: { id: true, placa: true, tipo: true, capacidadKg: true, estado: true },
    })
    setResponseStatus(event, 201)
    return { success: true, data: vehiculo }
  } catch (error) {
    // P2002 = unique violation sobre la placa.
    if (getErrorCode(error) === 'P2002') {
      throw createError({ statusCode: 400, statusMessage: 'Ya existe un vehiculo con esa placa' })
    }
    throw error
  }
})
