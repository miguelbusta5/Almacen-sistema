import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { ROL_PICKING, ROLES_GESTION_MUEBLES } from '../../utils/mueblesCalc'
import { parseDay, todayBogota } from '../../utils/exportacionesCalc'
import { mapEquipoMuebles } from '../../utils/mapRow'

/**
 * GET /api/muebles-admin/asignaciones - quien lleva que equipo un dia dado.
 *
 * Devuelve tambien los operarios SIN asignar: la pantalla del admin es la lista
 * del turno, y lo que hay que ver de un vistazo es a quien le falta equipo.
 */
export default defineEventHandler(async (event) => {
  await requireRole(event, ROLES_GESTION_MUEBLES)
  const q = getQuery(event)
  const fecha = parseDay(typeof q.fecha === 'string' ? q.fecha : null) ?? todayBogota()

  const [operarios, asignaciones] = await Promise.all([
    prisma.user.findMany({
      where: { role: ROL_PICKING as never, active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.asignacionEquipoMuebles.findMany({ where: { fecha }, include: { equipo: true } }),
  ])

  const porUsuario = new Map(asignaciones.map((a) => [a.usuarioId, a.equipo]))

  return {
    success: true,
    data: {
      fecha: fecha.toISOString().slice(0, 10),
      operarios: operarios.map((o) => ({
        id: o.id,
        nombre: o.name,
        equipo: porUsuario.has(o.id) ? mapEquipoMuebles(porUsuario.get(o.id)) : null,
      })),
    },
  }
})
