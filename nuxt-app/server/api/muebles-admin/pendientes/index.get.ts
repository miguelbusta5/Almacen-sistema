import { defineEventHandler } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireRole } from '../../../utils/auth'
import { ROL_PICKING, ROLES_GESTION_MUEBLES } from '../../../utils/mueblesCalc'
import { mapPendienteMuebles } from '../../../utils/mapRow'

/** GET /api/muebles-admin/pendientes - cola completa + operarios a quien asignar. */
export default defineEventHandler(async (event) => {
  await requireRole(event, ROLES_GESTION_MUEBLES)

  const [pendientes, operarios] = await Promise.all([
    prisma.pendienteMuebles.findMany({
      where: { estado: { in: ['PENDIENTE', 'ASIGNADO'] } },
      include: {
        orden: { select: { id: true, codigo: true } },
        creadoPorInspector: { select: { id: true, nombre: true } },
        asignadoA: { select: { id: true, name: true } },
        resueltoPor: { select: { id: true, name: true } },
      },
      orderBy: { solicitadoAt: 'asc' },
    }),
    prisma.user.findMany({
      where: { role: ROL_PICKING as never, active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return {
    success: true,
    data: {
      pendientes: pendientes.map(mapPendienteMuebles),
      operarios: operarios.map((o) => ({ id: o.id, nombre: o.name })),
    },
  }
})
