import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { auditarCargue, CARGUE_INCLUDE, mapCargue, requireCargue } from '../../utils/cargueCamion'
import { normalizarOtrosOperarios, normalizarPlaca, normalizarTextoCargue, validarInicioCamion } from '../../utils/cargueCamionCalc'
import { todayBogota } from '../../utils/exportacionesCalc'

const schema = z.object({
  tipoVehiculo: z.string().max(80),
  transportadora: z.string().max(120),
  placa: z.string().max(30).nullable().optional(),
  observacion: z.string().max(300).nullable().optional(),
  operarios: z.array(z.string().min(1)).max(30),
  otrosOperarios: z.array(z.string().max(80)).max(10).optional(),
})

/**
 * POST /api/cargue-camiones - INICIA el cargue del camion y arranca su reloj.
 * Pueden estar varios camiones abiertos a la vez (varios muelles).
 */
export default defineEventHandler(async (event) => {
  const actor = await requireCargue(event)
  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  const d = parsed.data
  const operarios = [...new Set(d.operarios)]
  const otros = normalizarOtrosOperarios(d.otrosOperarios)

  const error = validarInicioCamion({ ...d, operarios, otros })
  if (error) throw createError({ statusCode: 400, statusMessage: error })

  const validos = await prisma.operarioCargue.count({ where: { id: { in: operarios }, activo: true } })
  if (validos !== operarios.length) throw createError({ statusCode: 400, statusMessage: 'Alguna persona elegida no existe o esta inactiva' })

  const now = new Date()
  const creado = await prisma.cargueCamion.create({
    data: {
      tipoVehiculo: normalizarTextoCargue(d.tipoVehiculo),
      transportadora: normalizarTextoCargue(d.transportadora),
      placa: normalizarPlaca(d.placa),
      observacion: d.observacion?.trim() || null,
      otrosOperarios: otros,
      fecha: todayBogota(now),
      // El reloj lo sella el servidor, no el telefono.
      horaInicio: now,
      creadoPorId: actor.id,
      operarios: { create: operarios.map((operarioId) => ({ operarioId })) },
    },
    include: CARGUE_INCLUDE,
  })

  await auditarCargue(actor.id, 'CREATE', creado.id,
    `Cargue iniciado: ${creado.tipoVehiculo} de ${creado.transportadora}${creado.placa ? ` (${creado.placa})` : ''}`)
  return { success: true, data: mapCargue(creado) }
})
