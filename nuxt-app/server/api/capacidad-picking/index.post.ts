import { defineEventHandler, readBody, createError } from 'h3'
import { requireAuth } from '../../utils/auth'
import { bloquearPicking, exigirPicking, informeConMaestro } from '../../utils/picking'
import { prisma } from '../../utils/prisma'
import { textoPicking } from '../../utils/pickingCalc'
import { resolverPluMaestro } from '../../utils/codigoProducto'
export default defineEventHandler(async event => {
  const actor = await requireAuth(event); await exigirPicking(actor)
  const b = await readBody(event)
  if (!b || typeof b.accion !== 'string') throw createError({ statusCode: 400, statusMessage: 'Acción requerida' })
  return prisma.$transaction(async tx => {
    await bloquearPicking(tx)
    if (b.accion === 'crear') {
      const abierto = await tx.pickingInforme.findFirst({ where: { autorId: actor.id, estado: 'ABIERTO' }, include: { lineas: true } })
      return informeConMaestro(tx, abierto ?? await tx.pickingInforme.create({ data: { autorId: actor.id, autorNombre: actor.name }, include: { lineas: true } }))
    }
    const r = await tx.pickingInforme.findUnique({ where: { id: String(b.id) }, include: { lineas: true } })
    if (!r) throw createError({ statusCode: 404, statusMessage: 'Informe no encontrado' })
    if (r.autorId !== actor.id || r.estado !== 'ABIERTO') throw createError({ statusCode: 409, statusMessage: 'Solo puedes modificar tu informe abierto; crea otro para corregir capacidades' })
    if (b.revision !== r.revision) throw createError({ statusCode: 409, statusMessage: 'El informe cambió en otra pantalla. Actualiza antes de continuar' })
    const now = new Date()
    if (b.accion === 'reanudar') {
      if (!r.pausaInicio) throw createError({ statusCode: 409, statusMessage: 'El informe no está pausado' })
      await tx.pickingInforme.update({ where: { id: r.id }, data: { pausaSegundos: r.pausaSegundos + (now.getTime() - r.pausaInicio.getTime()) / 1000, pausas: [...(r.pausas as object[]), { motivo: r.pausaMotivo, inicio: r.pausaInicio.toISOString(), fin: now.toISOString() }], pausaInicio: null, pausaMotivo: null } })
    } else {
      if (r.pausaInicio) throw createError({ statusCode: 409, statusMessage: 'Reanuda el informe para continuar' })
      if (b.accion === 'pausar') {
        if (!['ALIMENTACION', 'FIN_TURNO'].includes(b.motivo)) throw createError({ statusCode: 400, statusMessage: 'Motivo inválido' })
        await tx.pickingInforme.update({ where: { id: r.id }, data: { pausaInicio: now, pausaMotivo: b.motivo } })
      } else if (b.accion === 'linea') {
        const plu = await resolverPluMaestro(textoPicking(b.plu), tx), ubicacion = textoPicking(b.ubicacion)
        if (!plu || plu.length > 100 || !ubicacion || ubicacion.length > 120 || !Number.isSafeInteger(b.cajas) || b.cajas < 1 || b.cajas > 100000 || !['SENCILLO', 'DOBLE'].includes(b.tipo)) throw createError({ statusCode: 400, statusMessage: 'Completa PLU, ubicación, cajas enteras y tipo de picking' })
        if (!await tx.productoMaestro.findUnique({ where: { plu } })) throw createError({ statusCode: 400, statusMessage: 'PLU no encontrado en el maestro' })
        if (r.lineas.some(l => l.ubicacion === ubicacion && l.plu !== plu)) throw createError({ statusCode: 409, statusMessage: 'Esta ubicación ya tiene otro PLU en el informe' })
        await tx.pickingLinea.upsert({ where: { informeId_plu: { informeId: r.id, plu } }, create: { informeId: r.id, plu, ubicacion, cajas: b.cajas, tipo: b.tipo }, update: { ubicacion, cajas: b.cajas, tipo: b.tipo } })
      } else if (b.accion === 'quitar') {
        await tx.pickingLinea.deleteMany({ where: { informeId: r.id, plu: String(b.plu) } })
      } else if (b.accion === 'finalizar') {
        if (!r.lineas.length) throw createError({ statusCode: 400, statusMessage: 'Registra al menos un PLU' })
        const ocupadas = await tx.pickingCapacidad.findMany({ where: { ubicacion: { in: r.lineas.map(l => l.ubicacion) }, plu: { notIn: r.lineas.map(l => l.plu) } } })
        if (ocupadas.length) throw createError({ statusCode: 409, statusMessage: `Ubicación asignada a otro PLU: ${ocupadas[0]!.ubicacion}` })
        await tx.pickingCapacidad.deleteMany({ where: { plu: { in: r.lineas.map(l => l.plu) } } })
        await tx.pickingCapacidad.createMany({ data: r.lineas.map(l => ({ plu: l.plu, ubicacion: l.ubicacion, cajas: l.cajas, tipo: l.tipo, informeId: r.id })) })
        await tx.pickingInforme.update({ where: { id: r.id }, data: { estado: 'FINALIZADO', fin: now } })
      } else throw createError({ statusCode: 400, statusMessage: 'Acción inválida' })
    }
    await tx.activityLog.create({ data: { userId: actor.id, action: 'UPDATE', module: 'capacidad-picking', recordId: r.id, details: `${b.accion}${b.plu ? ': ' + textoPicking(b.plu) : ''}` } })
    return informeConMaestro(tx, await tx.pickingInforme.update({ where: { id: r.id }, data: { revision: { increment: 1 } }, include: { lineas: true } }))
  }, { timeout: 30000 })
})
