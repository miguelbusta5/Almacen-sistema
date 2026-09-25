import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../../../utils/prisma'
import { auditar, ordenPorId, ORDEN_INCLUDE, requireInspeccion } from '../../../../../utils/muebles'
import { esGestionMuebles, validarCorreccionInspector } from '../../../../../utils/mueblesCalc'
import { mapOrdenMuebles } from '../../../../../utils/mapRow'

const schema = z.object({
  inspectorId: z.string().min(1),
  motivo: z.string().max(300),
})

/**
 * POST /api/inspeccion-muebles/:id/linea/:lineaId/inspector - corrige a nombre
 * de quien quedo el PLU (25-09).
 *
 * Las PCs se comparten y a veces el PLU queda a nombre de otro inspector: sus
 * tiempos se le contaban a quien no los hizo. Solo supervision (ADMIN, GERENTE,
 * SUPERVISOR_ALMACENAMIENTO) lo corrige, con motivo, y queda en auditoria quien
 * era y quien quedo. Sirve para el PLU en curso, el que ya esta listo y el de
 * una orden ya inspeccionada o entregada (desde el historial): los relojes no
 * se tocan, solo cambia de quien son.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireInspeccion(event)
  if (!esGestionMuebles(actor.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Solo supervision puede corregir el inspector de un PLU' })
  }
  const id = getRouterParam(event, 'id')!
  const lineaId = getRouterParam(event, 'lineaId')!

  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const d = parsed.data

  const orden = await ordenPorId(id)
  const linea = orden.lineas.find((l) => l.id === lineaId)
  if (!linea) throw createError({ statusCode: 404, statusMessage: 'PLU no encontrado en esta orden' })

  const error = validarCorreccionInspector({
    estado: linea.estado, inspectorActual: linea.inspector?.id ?? null, inspectorNuevo: d.inspectorId, motivo: d.motivo,
  })
  if (error) throw createError({ statusCode: 400, statusMessage: error })

  const nuevo = await prisma.inspector.findFirst({ where: { id: d.inspectorId, activo: true }, select: { id: true, nombre: true } })
  if (!nuevo) throw createError({ statusCode: 404, statusMessage: 'Inspector no encontrado' })

  const actualizada = await prisma.$transaction(async (tx) => {
    await tx.lineaMuebles.update({ where: { id: linea.id }, data: { inspectorId: nuevo.id } })
    // Queda tambien entre los inspectores que trabajaron la orden.
    await tx.inspectorOrdenMuebles.upsert({
      where: { ordenId_inspectorId: { ordenId: orden.id, inspectorId: nuevo.id } },
      create: { ordenId: orden.id, inspectorId: nuevo.id },
      update: {},
    })
    return tx.ordenMuebles.findUniqueOrThrow({ where: { id: orden.id }, include: ORDEN_INCLUDE })
  })

  await auditar(
    actor.id, 'UPDATE', 'inspeccion-muebles', orden.id,
    // Empieza por «Correccion»: asi sale en las correcciones del historial de la orden.
    `Correccion de inspector ${orden.codigo} PLU ${linea.plu}: inspector ${linea.inspector?.nombre ?? 'sin inspector'} -> ${nuevo.nombre}. Motivo: ${d.motivo.trim()}`,
  )

  return { success: true, data: mapOrdenMuebles(actualizada) }
})
