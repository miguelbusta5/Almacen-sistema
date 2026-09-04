import { defineEventHandler, readBody, setResponseStatus, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { mapEstiba } from '../../utils/mapRow'
import { todayBogota } from '../../utils/exportacionesCalc'
import { assertUsuarioEstibas, ESTIBA_INCLUDE, resolverProducto } from '../../utils/estibas'
import { calcularCantidadTotal, normalizarPedido, validarCapturaEstiba } from '../../utils/estibasCalc'

const createSchema = z.object({
  pedido: z.string().min(1).max(50),
  // PLU o EAN: lo que haya leído la pistola o tecleado el operario.
  codigo: z.string().min(1).max(100),
  cajas: z.number().int().min(1),
  // Opcional: si el maestro trae "Und Emp" manda el maestro. Solo se acepta del
  // cliente cuando el catálogo no lo tiene (~71% de los productos).
  unidadesPorCaja: z.number().int().min(1).optional(),
})

// POST /api/estibas — crea la estiba y ARRANCA EL RELOJ (horaInicio la sella el
// servidor, no el cliente: es la medición de productividad que sustituye al
// NOW() volátil de la planilla de Excel).
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioEstibas(actor.role)

  const parsed = createSchema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }

  // Una sola estiba abierta por operario. A diferencia de Exportaciones NO se
  // auto-cierra la anterior: cerrarla sin ubicación dejaría el registro sin el
  // dato que da sentido a la estiba. Se devuelve la abierta para que la UI
  // salte al paso de ubicar en vez de duplicar.
  const abierta = await prisma.estiba.findFirst({
    where: { creadoPorId: actor.id, horaFinalizacion: null, deletedAt: null },
    include: ESTIBA_INCLUDE,
    orderBy: [{ horaInicio: 'desc' }],
  })
  if (abierta) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Ya tienes una estiba en curso. Asígnale la ubicación antes de crear otra.',
      data: { code: 'ESTIBA_ABIERTA', estiba: mapEstiba(abierta) },
    })
  }

  const producto = await resolverProducto(parsed.data.codigo)
  if (!producto) {
    throw createError({ statusCode: 404, statusMessage: 'PLU o código de barras no encontrado en el maestro' })
  }
  const descripcion = producto.descripcion?.trim()
  if (!descripcion) {
    throw createError({ statusCode: 400, statusMessage: 'El producto no tiene descripción en el maestro' })
  }

  // El maestro manda cuando tiene el dato; si no, se exige que lo mande el
  // cliente y se marca como manual para poder completar el catálogo después.
  const unidadesPorCaja = producto.unidadesPorCaja ?? parsed.data.unidadesPorCaja ?? 0
  const unidadesManuales = producto.unidadesPorCaja == null

  const pedido = normalizarPedido(parsed.data.pedido)
  const validation = validarCapturaEstiba({
    pedido,
    codigo: parsed.data.codigo,
    cajas: parsed.data.cajas,
    unidadesPorCaja,
  })
  if (validation) throw createError({ statusCode: 400, statusMessage: validation })

  const now = new Date()
  const created = await prisma.estiba.create({
    data: {
      pedido,
      plu: producto.plu,
      ean: producto.ean,
      descripcion,
      cajas: parsed.data.cajas,
      unidadesPorCaja,
      unidadesManuales,
      cantidadTotal: calcularCantidadTotal(parsed.data.cajas, unidadesPorCaja),
      fecha: todayBogota(now),
      horaInicio: now,
      creadoPorId: actor.id,
    },
    include: ESTIBA_INCLUDE,
  })

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: 'CREATE',
      module: 'estibas',
      recordId: created.id,
      details: `Pedido ${created.pedido} PLU ${created.plu} · ${created.cajas} cajas`,
    },
  }).catch(() => {})

  setResponseStatus(event, 201)
  return { success: true, data: mapEstiba(created) }
})
