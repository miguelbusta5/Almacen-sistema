import { defineEventHandler, readMultipartFormData, createError } from 'h3'
import { requireAuth } from '../../utils/auth'
import { exigirTeorico, previewPicking } from '../../utils/picking'
import { prisma } from '../../utils/prisma'
import { readWorkbook, worksheetRows } from '../../utils/excel'
import { leerTeoricoPicking } from '../../utils/pickingCalc'
export default defineEventHandler(async event => {
  const actor = await requireAuth(event); await exigirTeorico(actor)
  const parts = await readMultipartFormData(event)
  const f = parts?.find(p => p.name === 'archivo')
  if (!f?.filename?.toLowerCase().endsWith('.xlsx') || f.data.length > 10 * 1024 * 1024) throw createError({ statusCode: 400, statusMessage: 'Sube un archivo .xlsx de máximo 10 MB' })
  let filas
  try {
    const wb = await readWorkbook(f.data)
    const hoja = wb.worksheets[0]
    if (!hoja) throw new Error('Archivo sin hojas')
    filas = leerTeoricoPicking(worksheetRows(hoja))
  } catch (error) { throw createError({ statusCode: 400, statusMessage: error instanceof Error ? error.message : 'Excel inválido' }) }
  return prisma.$transaction(async tx => {
    const carga = await tx.pickingTeorico.create({ data: { nombre: f.filename!, autorId: actor.id, filas: filas.map(r => ({ ...r })) } })
    return previewPicking(tx, carga.id)
  }, { timeout: 30000 })
})
