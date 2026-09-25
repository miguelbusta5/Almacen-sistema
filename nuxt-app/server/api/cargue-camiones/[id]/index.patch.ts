import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { auditarCargue, camionPorId, mapCargue, requireCargue } from '../../../utils/cargueCamion'
import { esGestionCargue, normalizarPlaca, normalizarTextoCargue, validarInicioCamion } from '../../../utils/cargueCamionCalc'

const schema = z.object({
  tipoVehiculo: z.string().max(80),
  transportadora: z.string().max(120),
  placa: z.string().max(30).nullable().optional(),
  observacion: z.string().max(300).nullable().optional(),
  operarios: z.array(z.string().min(1)).max(30),
  motivo: z.string().max(300).nullable().optional(),
})

/**
 * PATCH /api/cargue-camiones/:id - corrige los datos del camion y quienes lo
 * cargan (agregar a alguien que llego despues, quitar a quien se fue). Con el
 * camion abierto lo hace quien opera; ya finalizado, solo supervision y con
 * motivo.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireCargue(event)
  const camion = await camionPorId(getRouterParam(event, 'id')!)
  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  const d = parsed.data
  const operarios = [...new Set(d.operarios)]
  const error = validarInicioCamion({ ...d, operarios })
  if (error) throw createError({ statusCode: 400, statusMessage: error })

  const cerrado = camion.estado === 'CERRADO'
  if (cerrado && !esGestionCargue(actor.role)) {
    throw createError({ statusCode: 403, statusMessage: 'El camion ya se finalizo: solo supervision lo corrige' })
  }
  if (cerrado && (d.motivo?.trim().length ?? 0) < 5) {
    throw createError({ statusCode: 400, statusMessage: 'Escribe el motivo de la correccion (minimo 5 caracteres)' })
  }
  // Los que ya estaban pueden seguir aunque hoy esten inactivos; los nuevos, activos.
  const previos = new Set(camion.operarios.map((o) => o.operario.id))
  const nuevos = operarios.filter((id) => !previos.has(id))
  const validos = await prisma.operarioCargue.count({ where: { id: { in: nuevos }, activo: true } })
  if (validos !== nuevos.length) throw createError({ statusCode: 400, statusMessage: 'Alguna persona elegida no existe o esta inactiva' })

  await prisma.$transaction(async (tx) => {
    await tx.cargueCamion.update({
      where: { id: camion.id },
      data: {
        tipoVehiculo: normalizarTextoCargue(d.tipoVehiculo),
        transportadora: normalizarTextoCargue(d.transportadora),
        placa: normalizarPlaca(d.placa),
        observacion: d.observacion?.trim() || null,
        ...(cerrado && { motivoCorreccion: d.motivo!.trim() }),
      },
    })
    await tx.cargueCamionOperario.deleteMany({ where: { cargueId: camion.id, operarioId: { notIn: operarios } } })
    for (const operarioId of nuevos) await tx.cargueCamionOperario.create({ data: { cargueId: camion.id, operarioId } })
  })

  await auditarCargue(actor.id, 'UPDATE', camion.id,
    `${cerrado ? 'Correccion del camion' : 'Camion actualizado'}: ${operarios.length} personas cargando${cerrado ? `. Motivo: ${d.motivo!.trim()}` : ''}`)
  return { success: true, data: mapCargue(await camionPorId(camion.id)) }
})
