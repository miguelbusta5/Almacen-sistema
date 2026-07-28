import { defineEventHandler, readBody, setResponseStatus, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireRole } from '../../../utils/auth'
import { transportistaCreateSchema } from '../../../utils/usuarios'

// POST /api/users/transportistas-operativos — alta de conductor. Solo ADMIN.
export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])

  const parsed = transportistaCreateSchema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const d = parsed.data

  if (d.vehiculoId) {
    const vehiculo = await prisma.vehiculo.findUnique({ where: { id: d.vehiculoId }, select: { id: true } })
    if (!vehiculo) throw createError({ statusCode: 400, statusMessage: 'Vehiculo no encontrado' })
  }

  const transportista = await prisma.transportista.create({
    data: {
      nombre: d.nombre.trim(),
      telefono: d.telefono?.trim() || null,
      vehiculoId: d.vehiculoId || null,
    },
    select: {
      id: true, nombre: true, telefono: true, activo: true,
      vehiculo: { select: { id: true, placa: true, tipo: true, estado: true } },
    },
  })

  setResponseStatus(event, 201)
  return { success: true, data: transportista }
})
