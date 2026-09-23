import { defineOperacionAlmacenHandler } from '../../utils/operacionAlmacen'
import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { mapRecepcion } from '../../utils/mapRow'
import { assertUsuarioRecepcion, fijarDescargadores, RECEPCION_INCLUDE } from '../../utils/recepcion'
import { normalizarPedido, normalizarProveedor, validarApertura } from '../../utils/recepcionCalc'
import { todayBogota } from '../../utils/exportacionesCalc'

const schema = z.object({
  numeroPedido: z.string().min(1).max(50),
  proveedor: z.string().min(1).max(160),
  tipoProducto: z.enum(['GOURMET', 'MUEBLES']),
  tipoContenedor: z.enum(['CARGA_SUELTA', 'PIES_20', 'PIES_40'], { message: 'Elige el tipo de contenedor: carga suelta, 20 o 40 pies' }),
  pesoKg: z.number().positive(),
  referenciasEsperadas: z.number().int(),
  cajas: z.number().int(),
  unidades: z.number().int(),
  descargadores: z.array(z.string()).min(1),
})

/**
 * POST /api/recepcion-contenedores - abre la planilla y ARRANCA EL RELOJ.
 *
 * Una recepcion abierta por persona: el operario esta fisicamente en un
 * contenedor, no en dos. Si ya tiene una, se devuelve 409 con esa planilla para
 * que la UI lo lleve alli en vez de arrancar un segundo reloj.
 */
export default defineOperacionAlmacenHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioRecepcion(actor.role)

  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const d = parsed.data

  const error = validarApertura(d)
  if (error) throw createError({ statusCode: 400, statusMessage: error })

  const abierta = await prisma.recepcionContenedor.findFirst({
    where: { creadoPorId: actor.id, estado: 'EN_CURSO', deletedAt: null },
    include: RECEPCION_INCLUDE,
  })
  if (abierta) {
    throw createError({
      statusCode: 409,
      statusMessage: `Ya tienes el contenedor ${abierta.numeroPedido} abierto`,
      data: { recepcion: mapRecepcion(abierta) },
    })
  }

  const now = new Date()
  const creada = await prisma.$transaction(async (tx) => {
    const r = await tx.recepcionContenedor.create({
      data: {
        numeroPedido: normalizarPedido(d.numeroPedido),
        proveedor: normalizarProveedor(d.proveedor),
        tipoProducto: d.tipoProducto,
        tipoContenedor: d.tipoContenedor,
        pesoKg: d.pesoKg,
        referenciasEsperadas: d.referenciasEsperadas,
        cajas: d.cajas,
        unidades: d.unidades,
        fecha: todayBogota(now),
        // El reloj lo sella el servidor: el del telefono del operario puede
        // estar en cualquier hora.
        horaInicio: now,
        creadoPorId: actor.id,
      },
      select: { id: true },
    })
    await fijarDescargadores(tx, r.id, d.descargadores)
    return tx.recepcionContenedor.findUniqueOrThrow({
      where: { id: r.id },
      include: RECEPCION_INCLUDE,
    })
  })

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: 'CREATE',
      module: 'recepcion-contenedores',
      recordId: creada.id,
      details: `Contenedor ${creada.numeroPedido} de ${creada.proveedor} - reloj iniciado`,
    },
  }).catch(() => {})

  return { success: true, data: mapRecepcion(creada) }
})
