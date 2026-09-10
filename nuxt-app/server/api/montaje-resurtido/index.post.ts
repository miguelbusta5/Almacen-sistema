import { defineEventHandler, readMultipartFormData, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { mapMontaje } from '../../utils/mapRow'
import { assertPuedeMontar, assertVeMontaje, MONTAJE_INCLUDE } from '../../utils/resurtido'
import {
  columnasResurtido, faltanColumnas, mapFilaResurtido, ordenarPorPosicion,
} from '../../utils/resurtidoCalc'
import { readWorkbook, worksheetRows } from '../../utils/excel'
import { todayBogota } from '../../utils/exportacionesCalc'

const MAX_SIZE = 5 * 1024 * 1024
const MAX_FILAS = 2000

/**
 * POST /api/montaje-resurtido - sube el archivo y lo reparte a un operario.
 *
 * El montaje NO arranca ningun reloj: quien sube el archivo esta repartiendo
 * trabajo, no haciendolo. Lo que se cronometra es cada tarea, y empieza cuando
 * el operario escanea la posicion.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertVeMontaje(actor.role)
  await assertPuedeMontar(actor.id)

  const parts = await readMultipartFormData(event)
  const archivo = parts?.find((p) => p.name === 'archivo')
  const operarioId = parts?.find((p) => p.name === 'operarioId')?.data?.toString().trim()

  if (!archivo) throw createError({ statusCode: 400, statusMessage: 'Sube el archivo del resurtido' })
  if (!operarioId) throw createError({ statusCode: 400, statusMessage: 'Elige a que operario se le asigna' })
  if (!archivo.filename?.toLowerCase().endsWith('.xlsx')) {
    throw createError({ statusCode: 400, statusMessage: 'Solo se aceptan archivos .xlsx' })
  }
  if (archivo.data.length > MAX_SIZE) {
    throw createError({ statusCode: 400, statusMessage: 'Maximo 5 MB por archivo' })
  }

  const operario = await prisma.user.findFirst({
    where: { id: operarioId, active: true, role: { in: ['OPERARIO_ALMACENAMIENTO', 'MONTACARGAS'] } },
    select: { id: true, name: true },
  })
  if (!operario) throw createError({ statusCode: 400, statusMessage: 'Ese operario no existe o esta inactivo' })

  const wb = await readWorkbook(archivo.data)
  const sheet = wb.getWorksheet('Resurtido') ?? wb.worksheets[0]
  if (!sheet) throw createError({ statusCode: 400, statusMessage: 'El archivo no tiene ninguna hoja' })

  const filas = worksheetRows(sheet)
  if (filas.length < 2) throw createError({ statusCode: 400, statusMessage: 'El archivo esta vacio' })

  const cols = columnasResurtido(filas[0])
  const falta = faltanColumnas(cols)
  if (falta) throw createError({ statusCode: 400, statusMessage: falta })

  const crudas = filas.slice(1)
  if (crudas.length > MAX_FILAS) {
    throw createError({ statusCode: 400, statusMessage: `El archivo supera las ${MAX_FILAS} filas` })
  }

  const validas = crudas
    .map((f) => mapFilaResurtido(f, cols))
    .filter((f): f is NonNullable<typeof f> => f !== null)
  if (validas.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Ninguna fila del archivo es valida' })
  }

  // La descripcion sale del MAESTRO, no de la columna NOMBRE del archivo: ese
  // nombre puede venir de una exportacion vieja y mandaria al operario a coger
  // un producto distinto del que dice la etiqueta.
  const plus = [...new Set(validas.map((f) => f.plu))]
  const productos = await prisma.productoMaestro.findMany({
    where: { plu: { in: plus } },
    select: { plu: true, descripcion: true },
  })
  const porPlu = new Map(productos.map((p) => [p.plu, p.descripcion ?? '']))

  const desconocidos = plus.filter((p) => !porPlu.has(p))
  if (desconocidos.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Estos PLU no estan en el maestro: ${desconocidos.slice(0, 8).join(', ')}`
        + (desconocidos.length > 8 ? ` y ${desconocidos.length - 8} mas` : ''),
    })
  }

  // Ordenadas por posicion: el operario recorre el almacen una vez y en linea
  // recta en vez de saltar de un pasillo a otro y volver.
  const ordenadas = ordenarPorPosicion(validas)
  const now = new Date()

  const creado = await prisma.$transaction(async (tx) => {
    const m = await tx.montajeResurtido.create({
      data: {
        nombreArchivo: archivo.filename!,
        operarioId: operario.id,
        creadoPorId: actor.id,
        fecha: todayBogota(now),
        montadoAt: now,
        tareas: {
          create: ordenadas.map((f, i) => ({
            orden: i + 1,
            plu: f.plu,
            descripcion: porPlu.get(f.plu) || f.plu,
            altura: f.altura,
            pickingSugerido: f.picking,
            unidadesSolicitadas: f.unidadesSolicitadas,
          })),
        },
      },
      select: { id: true },
    })
    return tx.montajeResurtido.findUniqueOrThrow({
      where: { id: m.id },
      include: MONTAJE_INCLUDE,
    })
  })

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: 'CREATE',
      module: 'montaje-resurtido',
      recordId: creado.id,
      details: `${ordenadas.length} tareas asignadas a ${operario.name} (${archivo.filename})`,
    },
  }).catch(() => {})

  return { success: true, data: mapMontaje(creado) }
})
