import { defineEventHandler, readBody, createError } from 'h3'
import { requireAuth } from '../../utils/auth'
import { bloquearPicking, exigirTeorico, previewPicking } from '../../utils/picking'
import { prisma } from '../../utils/prisma'
import { todayBogota } from '../../utils/exportacionesCalc'
import type { PickingValidacion } from '../../utils/pickingCalc'
export default defineEventHandler(async event => {
  const actor = await requireAuth(event); await exigirTeorico(actor)
  const b = await readBody(event)
  if (!b || typeof b.id !== 'string') throw createError({ statusCode: 400, statusMessage: 'Selecciona un teórico' })
  return prisma.$transaction(async tx => {
    await bloquearPicking(tx)
    const p = await previewPicking(tx, String(b.id))
    if (p.carga.montajeId) throw createError({ statusCode: 409, statusMessage: 'Este teórico ya generó un montaje. Carga inventario actualizado' })
    if (b.accion === 'validar') {
      const r = p.filas.find(f => f.plu === b.plu)
      if (!r?.doble || !r.ubicaciones.includes(r.ubicacion) || b.ubicacion !== r.ubicacion) throw createError({ statusCode: 400, statusMessage: 'Confirma el picking registrado en Capacidad picking' })
      const carga = await tx.pickingTeorico.findUniqueOrThrow({ where: { id: p.carga.id } })
      const validaciones = { ...(carga.validaciones as unknown as Record<string, PickingValidacion>), [r.plu]: { ubicacion: r.ubicacion, usuarioId: actor.id, fecha: new Date().toISOString() } }
      await tx.pickingTeorico.update({ where: { id: carga.id }, data: { validaciones: JSON.parse(JSON.stringify(validaciones)) } })
      await tx.activityLog.create({ data: { userId: actor.id, action: 'UPDATE', module: 'capacidad-picking', recordId: carga.id, details: `Doble picking validado: ${r.plu} → ${r.ubicacion}` } })
    } else if (b.accion === 'generar') {
      // La vista previa es orientativa; se recalcula con el bloqueo adquirido.
      if (b.firma !== JSON.stringify(p.filas)) throw createError({ statusCode: 409, statusMessage: 'Cambió la capacidad o el trabajo pendiente. Actualiza la vista previa' })
      const operario = await tx.user.findFirst({ where: { id: String(b.operarioId), active: true, role: { in: ['OPERARIO_ALMACENAMIENTO', 'MONTACARGAS'] } } })
      if (!operario) throw createError({ statusCode: 400, statusMessage: 'Elige un operario activo' })
      const tareas = p.filas.flatMap(f => f.tareas).sort((a, z) => a.altura.localeCompare(z.altura, undefined, { numeric: true }))
      if (!tareas.length) throw createError({ statusCode: 400, statusMessage: 'No hay tareas válidas para generar' })
      const m = await tx.montajeResurtido.create({ data: { nombreArchivo: `Capacidad: ${p.carga.nombre}`.slice(0, 255), creadoPorId: actor.id, operarioId: operario.id, fecha: todayBogota(new Date()), tareas: { create: tareas.map((t, i) => ({ ...t, orden: i + 1 })) } } })
      await tx.pickingTeorico.update({ where: { id: p.carga.id }, data: { montajeId: m.id } })
      await tx.activityLog.create({ data: { userId: actor.id, action: 'CREATE', module: 'montaje-resurtido', recordId: m.id, details: `${tareas.length} tareas desde capacidad picking, teórico ${p.carga.id}` } })
    } else throw createError({ statusCode: 400, statusMessage: 'Acción inválida' })
    return previewPicking(tx, p.carga.id)
  }, { timeout: 30000 })
})
