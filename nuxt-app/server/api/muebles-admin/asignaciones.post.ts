import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { ROLES_GESTION_MUEBLES } from '../../utils/mueblesCalc'
import { auditar } from '../../utils/muebles'
import { parseDay, todayBogota } from '../../utils/exportacionesCalc'

const schema = z.object({
  usuarioId: z.string().min(1),
  // null = quitarle el equipo del dia.
  equipoId: z.string().min(1).nullable(),
  fecha: z.string().optional(),
})

/**
 * POST /api/muebles-admin/asignaciones - asigna el equipo del dia a un operario.
 *
 * Un equipo por operario por dia (unique en DB). Cambiar la asignacion NO mueve
 * las ordenes ya creadas: cada orden sello su equipo al abrirse.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, ROLES_GESTION_MUEBLES)

  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const { usuarioId, equipoId } = parsed.data
  const fecha = parseDay(parsed.data.fecha ?? null) ?? todayBogota()

  const usuario = await prisma.user.findUnique({ where: { id: usuarioId }, select: { id: true, name: true } })
  if (!usuario) throw createError({ statusCode: 404, statusMessage: 'Operario no encontrado' })

  if (equipoId == null) {
    await prisma.asignacionEquipoMuebles.deleteMany({ where: { usuarioId, fecha } })
    await auditar(actor.id, 'DELETE', 'picking-muebles', usuarioId, `Equipo retirado a ${usuario.name}`)
    return { success: true, data: { usuarioId, equipo: null } }
  }

  const equipo = await prisma.equipoMuebles.findFirst({ where: { id: equipoId, activo: true } })
  if (!equipo) throw createError({ statusCode: 404, statusMessage: 'Equipo no encontrado o inactivo' })

  await prisma.asignacionEquipoMuebles.upsert({
    where: { usuarioId_fecha: { usuarioId, fecha } },
    create: { usuarioId, fecha, equipoId, asignadoPorId: actor.id },
    update: { equipoId, asignadoPorId: actor.id },
  })

  await auditar(actor.id, 'UPDATE', 'picking-muebles', usuarioId, `${equipo.codigo} asignado a ${usuario.name}`)

  return { success: true, data: { usuarioId, equipo: { id: equipo.id, codigo: equipo.codigo, tipo: equipo.tipo } } }
})
