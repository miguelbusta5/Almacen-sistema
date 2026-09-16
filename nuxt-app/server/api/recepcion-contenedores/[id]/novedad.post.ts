import { defineOperacionAlmacenHandler } from '../../../utils/operacionAlmacen'
import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapRecepcion } from '../../../utils/mapRow'
import {
  assertUsuarioRecepcion, descripcionDePlu, esDuenoOGestor, RECEPCION_INCLUDE,
} from '../../../utils/recepcion'
import { validarLineaNovedad } from '../../../utils/recepcionCalc'
import { normalizePlu } from '../../../utils/exportacionesCalc'
import { resolverPluMaestro } from '../../../utils/codigoProducto'

const schema = z.object({
  tipo: z.enum(['FALTANTE', 'SOBRANTE', 'AVERIA', 'MALTRATADA']),
  plu: z.string().min(1).max(100),
  cantidad: z.number().int(),
  fotoUrl: z.string().url().nullable().optional(),
  observacion: z.string().max(500).nullable().optional(),
})

/**
 * POST /api/recepcion-contenedores/:id/novedad - anade una linea de reporte.
 *
 * Va DESPUES de cerrar: el reporte se levanta con el contenedor ya bajado, y no
 * cuenta tiempo. La descripcion sale del maestro y se COPIA aqui: si el maestro
 * cambia manana, el reporte tiene que seguir diciendo lo que se vio hoy.
 */
export default defineOperacionAlmacenHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioRecepcion(actor.role)

  const id = getRouterParam(event, 'id')!
  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const d = parsed.data

  const record = await prisma.recepcionContenedor.findUnique({
    where: { id },
    select: { estado: true, deletedAt: true, creadoPorId: true, numeroPedido: true },
  })
  if (!record || record.deletedAt) {
    throw createError({ statusCode: 404, statusMessage: 'Recepcion no encontrada' })
  }
  if (!esDuenoOGestor(actor, record)) {
    throw createError({ statusCode: 403, statusMessage: 'Solo puedes reportar sobre tus recepciones' })
  }
  if (record.estado !== 'CERRADO') {
    throw createError({
      statusCode: 409,
      statusMessage: 'Primero cierra la recepcion: los reportes se levantan con el contenedor abajo',
    })
  }

  const plu = await resolverPluMaestro(normalizePlu(d.plu))
  const descripcion = await descripcionDePlu(prisma, plu)

  const error = validarLineaNovedad(
    { plu, descripcion: descripcion ?? '', cantidad: d.cantidad, fotoUrl: d.fotoUrl ?? null },
    d.tipo,
  )
  if (error) throw createError({ statusCode: 400, statusMessage: error })

  await prisma.novedadRecepcion.create({
    data: {
      recepcionId: id,
      tipo: d.tipo,
      plu,
      descripcion: descripcion!,
      cantidad: d.cantidad,
      fotoUrl: d.fotoUrl ?? null,
      observacion: d.observacion ?? null,
      creadoPorId: actor.id,
    },
  })

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: 'CREATE',
      module: 'recepcion-contenedores',
      recordId: id,
      details: `${d.tipo} en contenedor ${record.numeroPedido}: PLU ${plu} x${d.cantidad}`,
    },
  }).catch(() => {})

  const updated = await prisma.recepcionContenedor.findUniqueOrThrow({
    where: { id },
    include: RECEPCION_INCLUDE,
  })
  return { success: true, data: mapRecepcion(updated) }
})
