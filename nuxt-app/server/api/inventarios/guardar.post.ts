import { createHash } from 'node:crypto'
import { createError, defineEventHandler, readMultipartFormData } from 'h3'
import { requireAuth } from '../../utils/auth'
import { exigirInventarios } from '../../utils/inventarios'
import { prisma } from '../../utils/prisma'
import { readWorkbook, worksheetRows } from '../../utils/excel'
import { fechasCronograma, leerMaestroPvp } from '../../utils/inventarioMaestro'

export default defineEventHandler(async event => {
  const actor = await requireAuth(event)
  await exigirInventarios(actor)
  const parts = await readMultipartFormData(event)
  const field = (name: string) => parts?.find(p => p.name === name)?.data.toString('utf8') ?? ''
  const archivo = parts?.find(p => p.name === 'archivo')
  if (!archivo?.filename?.toLowerCase().endsWith('.xlsx') || !archivo.data.length || archivo.data.length > 10 * 1024 * 1024) throw createError({ statusCode: 400, statusMessage: 'Selecciona un archivo .xlsx de máximo 10 MB' })
  let maestro
  try {
    const wb = await readWorkbook(archivo.data)
    if (!wb.worksheets[0]) throw new Error('El archivo no tiene hojas')
    maestro = leerMaestroPvp(worksheetRows(wb.worksheets[0]))
  } catch (e) { throw createError({ statusCode: 400, statusMessage: e instanceof Error ? e.message : 'No se pudo leer el maestro' }) }
  if (field('accion') === 'revisar') return { resumen: maestro.resumen, muestra: maestro.productos.slice(0, 5) }
  if (field('accion') !== 'guardar') throw createError({ statusCode: 400, statusMessage: 'Acción inválida' })
  const id = field('cronogramaId'), nombre = field('nombre').trim()
  let fechas: ReturnType<typeof fechasCronograma> | undefined
  if (!id) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(field('solicitudId'))) throw createError({ statusCode: 400, statusMessage: 'Vuelve a abrir el formulario de nuevo cronograma' })
    if (!nombre || nombre.length > 120) throw createError({ statusCode: 400, statusMessage: 'Escribe un nombre de máximo 120 caracteres' })
    try { fechas = fechasCronograma(field('inicio'), Number(field('dias'))) }
    catch (e) { throw createError({ statusCode: 400, statusMessage: (e as Error).message }) }
  }
  const hash = createHash('sha256').update(archivo.data).digest('hex')
  return prisma.$transaction(async tx => {
    // Serializa versiones y confirmaciones concurrentes entre instancias.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(71420918)`
    if (!id) {
      const existente = await tx.inventarioCronograma.findUnique({ where: { id: field('solicitudId') }, include: { versiones: { orderBy: { numero: 'desc' }, take: 1 } } })
      if (existente) {
        if (existente.autorId === actor.id && existente.versiones[0]?.hash === hash) return { id: existente.id, version: existente.versiones[0].numero }
        throw createError({ statusCode: 409, statusMessage: 'La solicitud ya se guardó. Recarga el cronograma' })
      }
    }
    const cronograma = id ? await tx.inventarioCronograma.findUnique({ where: { id } }) : await tx.inventarioCronograma.create({ data: { id: field('solicitudId'), nombre, ...fechas!, autorId: actor.id, autorNombre: actor.name } })
    if (!cronograma) throw createError({ statusCode: 404, statusMessage: 'Cronograma no encontrado' })
    if (cronograma.estado !== 'ABIERTO') throw createError({ statusCode: 409, statusMessage: 'El cronograma está cerrado' })
    const ultima = await tx.inventarioMaestroVersion.findFirst({ where: { cronogramaId: cronograma.id }, orderBy: { numero: 'desc' } })
    if (id && String(ultima?.numero ?? 0) !== field('version')) throw createError({ statusCode: 409, statusMessage: 'Otra persona actualizó el maestro. Recarga el cronograma y revisa la nueva versión' })
    if (ultima?.hash === hash) throw createError({ statusCode: 409, statusMessage: 'Este archivo ya es el maestro vigente' })
    const version = await tx.inventarioMaestroVersion.create({ data: { cronogramaId: cronograma.id, numero: (ultima?.numero ?? 0) + 1, archivo: archivo.filename!.slice(0, 255), hash, total: maestro.resumen.total, resumen: maestro.resumen, autorId: actor.id, autorNombre: actor.name } })
    for (let i = 0; i < maestro.productos.length; i += 1000) {
      await tx.inventarioProductoPvp.createMany({ data: maestro.productos.slice(i, i + 1000).map(p => ({ ...p, versionId: version.id })) })
    }
    await tx.activityLog.create({ data: { userId: actor.id, action: id ? 'UPDATE' : 'CREATE', module: 'inventarios', recordId: cronograma.id, details: `Maestro PVP v${version.numero}: ${version.total} productos; ${version.archivo}` } })
    return { id: cronograma.id, version: version.numero }
  }, { timeout: 60000 })
})
