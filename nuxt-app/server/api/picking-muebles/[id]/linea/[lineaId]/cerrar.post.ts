import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../../../utils/prisma'
import { auditar, esParticipante, ordenPorId, ORDEN_INCLUDE, requirePickingActivo, volumenDeOrden } from '../../../../../utils/muebles'
import { normalizarRotulo, totalesLinea } from '../../../../../utils/mueblesCalc'
import { mapOrdenMuebles } from '../../../../../utils/mapRow'

const schema = z.object({
  ubicacion: z.string().min(1).max(120),
  unidades: z.number().int().positive(),
  // El rotulo se guarda tal cual lo lee la pistola (hoy son codigos tipo
  // "M123134"): el formato no esta cerrado y bloquear al operario frente a la
  // estanteria por un patron que aun no conocemos cuesta mas de lo que evita.
  numeroCaja: z.string().min(1).max(60),
})

/**
 * POST /api/picking-muebles/:id/linea/:lineaId/cerrar - PARA EL RELOJ del PLU.
 *
 * Es el ultimo paso del ciclo: ubicacion de donde saco la mercancia, unidades y
 * escaneo del QR del rotulo, que es el que da el numero de caja. Aqui se sellan
 * los totales con los que se calcula la capacidad del equipo.
 */
export default defineEventHandler(async (event) => {
  const actor = await requirePickingActivo(event)
  const id = getRouterParam(event, 'id')!
  const lineaId = getRouterParam(event, 'lineaId')!

  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const d = parsed.data

  const orden = await ordenPorId(id)
  if (!esParticipante(orden, actor.id)) {
    throw createError({ statusCode: 403, statusMessage: 'No estas trabajando esa orden' })
  }

  const linea = orden.lineas.find((l) => l.id === lineaId)
  if (!linea) throw createError({ statusCode: 404, statusMessage: 'PLU no encontrado en esta orden' })
  // Cada uno cierra lo suyo: el reloj de ese PLU es de quien lo esta bajando, y
  // dejar que lo pare otro seria falsear su tiempo.
  if (linea.operarioId !== actor.id) {
    throw createError({ statusCode: 403, statusMessage: 'Ese PLU lo esta bajando otro operario' })
  }
  if (linea.estado !== 'EN_PICKING') {
    throw createError({ statusCode: 409, statusMessage: 'Ese PLU ya esta cerrado' })
  }

  const totales = totalesLinea(
    d.unidades,
    linea.volumenUnitarioM3 == null ? null : Number(linea.volumenUnitarioM3),
    linea.pesoUnitarioKg == null ? null : Number(linea.pesoUnitarioKg),
  )

  const now = new Date()
  const actualizada = await prisma.$transaction(async (tx) => {
    await tx.lineaMuebles.update({
      where: { id: lineaId },
      data: {
        ubicacion: d.ubicacion.trim(),
        unidades: d.unidades,
        numeroCaja: normalizarRotulo(d.numeroCaja),
        volumenTotalM3: totales.volumenTotalM3,
        pesoTotalKg: totales.pesoTotalKg,
        estado: 'PICKEADA',
        horaFin: now,
      },
    })
    return tx.ordenMuebles.findUniqueOrThrow({ where: { id: orden.id }, include: ORDEN_INCLUDE })
  })

  await auditar(
    actor.id, 'UPDATE', 'picking-muebles', orden.id,
    `PLU ${linea.plu} cerrado x${d.unidades} caja ${normalizarRotulo(d.numeroCaja)}`,
  )

  return {
    success: true,
    data: { orden: mapOrdenMuebles(actualizada), volumen: volumenDeOrden(actualizada) },
  }
})
