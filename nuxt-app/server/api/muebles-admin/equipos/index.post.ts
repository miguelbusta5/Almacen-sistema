import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireRole } from '../../../utils/auth'
import { ROLES_GESTION_MUEBLES } from '../../../utils/mueblesCalc'
import { auditar } from '../../../utils/muebles'
import { mapEquipoMuebles } from '../../../utils/mapRow'

const schema = z.object({
  codigo: z.string().min(1).max(40),
  tipo: z.enum(['ORDER_PICKER', 'GENIE']),
  // Nullable: los equipos se dan de alta antes de medirlos. El modulo funciona
  // mostrando m3 acumulados hasta que haya una capacidad contra la que comparar.
  capacidadM3: z.number().positive().nullable().optional(),
  capacidadKg: z.number().positive().nullable().optional(),
})

/** POST /api/muebles-admin/equipos - alta de equipo. */
export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, ROLES_GESTION_MUEBLES)

  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const codigo = parsed.data.codigo.trim().toUpperCase()

  const existe = await prisma.equipoMuebles.findUnique({ where: { codigo }, select: { id: true } })
  if (existe) throw createError({ statusCode: 409, statusMessage: `Ya existe un equipo ${codigo}` })

  const equipo = await prisma.equipoMuebles.create({
    data: {
      codigo,
      tipo: parsed.data.tipo,
      capacidadM3: parsed.data.capacidadM3 ?? null,
      capacidadKg: parsed.data.capacidadKg ?? null,
    },
  })

  await auditar(actor.id, 'CREATE', 'picking-muebles', equipo.id, `Equipo ${codigo} (${parsed.data.tipo}) creado`)

  return { success: true, data: mapEquipoMuebles(equipo) }
})
