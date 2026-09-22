import { createError, defineEventHandler, readMultipartFormData } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { actorInventario, auditarInventario, lockInventario } from '../../utils/inventarioCiclico'
import { readWorkbook, worksheetRows } from '../../utils/excel'
import { leerTeoricoInventario } from '../../utils/inventarioCiclicoCalc'
export default defineEventHandler(async event => {
  const actor = await requireAuth(event); await actorInventario(actor, true)
  const parts = await readMultipartFormData(event), field = (s: string) => parts?.find(p => p.name === s)?.data.toString('utf8') ?? ''
  const f = parts?.find(p => p.name === 'archivo')
  if (!f?.filename?.toLowerCase().endsWith('.xlsx') || f.data.length > 10 * 1024 * 1024) throw createError({ statusCode: 400, statusMessage: 'Sube el teórico .xlsx de dos hojas, máximo 10 MB' })
  let data
  try { const w = await readWorkbook(f.data); if (w.worksheets.length < 2) throw new Error('Faltan las dos hojas'); data = leerTeoricoInventario(worksheetRows(w.worksheets[0]!), worksheetRows(w.worksheets[1]!)) }
  catch (e) { throw createError({ statusCode: 400, statusMessage: (e as Error).message }) }
  const nombre = field('nombre').trim(), solicitud = field('solicitudId')
  if (!nombre || nombre.length > 120 || !/^[a-f0-9-]{36}$/i.test(solicitud)) throw createError({ statusCode: 400, statusMessage: 'Indica el nombre del cíclico y vuelve a intentar' })
  return prisma.$transaction(async tx => {
    await lockInventario(tx)
    const c = await tx.inventarioCronograma.findUnique({ where: { id: field('cronogramaId') }, include: { versiones: { take: 1 } } })
    if (!c || c.estado !== 'ABIERTO' || !c.versiones.length) throw createError({ statusCode: 409, statusMessage: 'Selecciona un cronograma abierto con maestro PVP' })
    const existente = await tx.inventarioCiclico.findUnique({ where: { id: solicitud } })
    if (existente) {
      if (existente.cronogramaId !== c.id || existente.autorId !== actor.id || existente.nombre !== nombre) throw createError({ statusCode: 409, statusMessage: 'Identificador de solicitud ya usado para otro cíclico' })
      return { id: existente.id }
    }
    const creado = await tx.inventarioCiclico.create({ data: { id: solicitud, cronogramaId: c.id, nombre, archivo: f.filename!.slice(0,255), autorId: actor.id, filas: data.filas.map(f => ({ ...f })), teorico: data.teorico, avisos: data.avisos } })
    await tx.inventarioTarea.createMany({ data: data.ubicaciones.map(ubicacion => ({ cicloId: creado.id, ubicacion })) })
    await auditarInventario(tx, actor, creado.id, `Teórico cargado: ${data.ubicaciones.length} ubicaciones RETIRO; ${data.fueraAlcance.length} PLU de hoja 2 fuera del alcance de hoja 1; excluidos sin teórico y con existencia cero: ${data.avisos.map(a => a.plu).join(", ") || "ninguno"}`)
    return { id: creado.id, fueraAlcance: data.fueraAlcance.length }
  }, { timeout: 30000 })
})
