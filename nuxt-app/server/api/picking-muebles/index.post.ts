import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { auditar, equipoDelDia, ordenAbierta, ORDEN_INCLUDE, requirePicking } from '../../utils/muebles'
import { derivarTipoOrden, normalizarCodigoOrden, validarCodigoOrden } from '../../utils/mueblesCalc'
import { todayBogota } from '../../utils/exportacionesCalc'
import { mapOrdenMuebles } from '../../utils/mapRow'

const schema = z.object({ codigo: z.string().min(1).max(40) })

/**
 * POST /api/picking-muebles - ARRANCA EL RELOJ de la orden.
 *
 * Una sola orden abierta por operario: con dos relojes corriendo a la vez el
 * tiempo de orden deja de significar nada, y en el area se trabaja una orden
 * completa antes de pasar a la siguiente.
 */
export default defineEventHandler(async (event) => {
  const actor = await requirePicking(event)

  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }

  const errCodigo = validarCodigoOrden(parsed.data.codigo)
  if (errCodigo) throw createError({ statusCode: 400, statusMessage: errCodigo })
  const codigo = normalizarCodigoOrden(parsed.data.codigo)

  const abierta = await ordenAbierta(actor.id)
  if (abierta) {
    throw createError({
      statusCode: 409,
      statusMessage: `Ya tienes una orden abierta (${abierta.codigo}): pasala a inspeccion antes de crear otra`,
    })
  }

  // Sin equipo asignado no hay contra que medir la capacidad, que es la mitad
  // del valor del modulo. Lo asigna el ADMIN cada dia.
  const equipo = await equipoDelDia(actor.id)
  if (!equipo) {
    throw createError({
      statusCode: 409,
      statusMessage: 'No tienes equipo asignado hoy: pide al administrador que te asigne el Order Picker o el Genie',
    })
  }

  const yaExiste = await prisma.ordenMuebles.findUnique({ where: { codigo }, select: { id: true } })
  if (yaExiste) {
    throw createError({ statusCode: 409, statusMessage: `La orden ${codigo} ya fue registrada` })
  }

  const now = new Date()
  const orden = await prisma.ordenMuebles.create({
    data: {
      codigo,
      tipoOrden: derivarTipoOrden(codigo),
      fecha: todayBogota(now),
      horaInicio: now,
      operarioId: actor.id,
      // Se sella el equipo del dia: si manana le cambian de equipo, la carga que
      // llevo esta orden no debe moverse.
      equipoId: equipo.id,
    },
    include: ORDEN_INCLUDE,
  })

  await auditar(actor.id, 'CREATE', 'picking-muebles', orden.id, `Orden ${codigo} abierta con ${equipo.codigo}`)

  return { success: true, data: mapOrdenMuebles(orden) }
})
