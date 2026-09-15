import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { assertPuedeMandarTarea, auditarTarea, mapTareaGeneral, TAREA_GENERAL_INCLUDE } from '../../utils/tareasGenerales'
import { esAsignable, MAX_DESCRIPCION, validarTarea } from '../../utils/tareasGeneralesCalc'
import { todayBogota } from '../../utils/exportacionesCalc'
import { avisar } from '../../utils/resurtido'

const schema = z.object({
  descripcion: z.string().min(1).max(MAX_DESCRIPCION),
  usuarioIds: z.array(z.string().min(1)).min(1).max(20),
})

/**
 * POST /api/tareas-generales - ARRANCA EL RELOJ de cada persona asignada.
 *
 * El reloj empieza al asignar, no cuando el operario toca nada: la tarea se la
 * mandan de viva voz y pedirle que la "acepte" en la app solo serviria para
 * perder los primeros minutos.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertPuedeMandarTarea(actor.role)

  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const d = parsed.data

  const error = validarTarea(d)
  if (error) throw createError({ statusCode: 400, statusMessage: error })

  const usuarios = await prisma.user.findMany({
    where: { id: { in: d.usuarioIds }, active: true },
    select: { id: true, name: true, role: true },
  })
  if (usuarios.length !== d.usuarioIds.length || usuarios.some((u) => !esAsignable(u.role))) {
    throw createError({ statusCode: 400, statusMessage: 'Alguno de los operarios ya no está disponible' })
  }

  const now = new Date()
  const tarea = await prisma.$transaction(async (tx) => {
    const creada = await tx.tareaGeneral.create({
      data: {
        descripcion: d.descripcion.trim(),
        fecha: todayBogota(now),
        horaInicio: now,
        creadoPorId: actor.id,
        asignados: { create: usuarios.map((u) => ({ usuarioId: u.id, horaInicio: now })) },
      },
      select: { id: true },
    })
    await avisar(tx, usuarios.map((u) => u.id), {
      tipo: 'TAREA_GENERAL_ASIGNADA',
      titulo: 'Tarea asignada',
      descripcion: `${actor.name ?? 'Supervisión'}: ${d.descripcion.trim()}`,
      enlace: '/dashboard/tareas-generales',
    })
    return tx.tareaGeneral.findUniqueOrThrow({ where: { id: creada.id }, include: TAREA_GENERAL_INCLUDE })
  })

  await auditarTarea(
    actor.id, 'CREATE', tarea.id,
    `Tarea general para ${usuarios.map((u) => u.name).join(', ')}: ${d.descripcion.trim()}`,
  )

  return { success: true, data: mapTareaGeneral(tarea) }
})
