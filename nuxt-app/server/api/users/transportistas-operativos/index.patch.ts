import { defineEventHandler, readBody, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireRole } from '../../../utils/auth'
import { transportistaUpdateSchema } from '../../../utils/usuarios'

// PATCH /api/users/transportistas-operativos — editar conductor (el id va en el
// body, como en la ruta Next). Solo ADMIN.
export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])

  const parsed = transportistaUpdateSchema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const { id, ...d } = parsed.data

  if (d.vehiculoId) {
    const vehiculo = await prisma.vehiculo.findUnique({ where: { id: d.vehiculoId }, select: { id: true } })
    if (!vehiculo) throw createError({ statusCode: 400, statusMessage: 'Vehiculo no encontrado' })
  }

  const transportista = await prisma.transportista.update({
    where: { id },
    data: {
      ...(d.nombre !== undefined ? { nombre: d.nombre.trim() } : {}),
      ...(d.telefono !== undefined ? { telefono: d.telefono?.trim() || null } : {}),
      ...(d.vehiculoId !== undefined ? { vehiculoId: d.vehiculoId || null } : {}),
      ...(d.activo !== undefined ? { activo: d.activo } : {}),
    },
    select: {
      id: true, nombre: true, telefono: true, activo: true,
      user: { select: { id: true, name: true, email: true, active: true } },
      vehiculo: { select: { id: true, placa: true, tipo: true, estado: true } },
    },
  })

  return { success: true, data: transportista }
})
