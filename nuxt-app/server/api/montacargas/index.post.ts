import { defineEventHandler, readBody, setResponseStatus, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { mapMovimientoMontacargas } from '../../utils/mapRow'
import { todayBogota } from '../../utils/exportacionesCalc'
import { assertUsuarioMontacargas, MOVIMIENTO_INCLUDE, resolverProducto } from '../../utils/montacargas'
import {
  calcularCantidadTotal, normalizarUbicacion, requiereUbicacionInicial, validarCaptura,
} from '../../utils/montacargasCalc'

const createSchema = z.object({
  tipo: z.enum(['RECEPCION', 'MOVIMIENTO', 'RESURTIDO']),
  // PLU o EAN: lo que haya leido la pistola o tecleado el operario.
  codigo: z.string().min(1).max(100),
  // 0 cajas es valido cuando el registro es solo de reguero.
  cajas: z.number().int().min(0),
  // Opcional: si el maestro trae "Und Emp" manda el maestro. Solo se acepta del
  // cliente cuando el catalogo no lo tiene (~71% de los productos).
  unidadesPorCaja: z.number().int().min(1).optional(),
  hayReguero: z.boolean().optional(),
  unidadesSueltas: z.number().int().min(0).optional(),
  // Obligatoria en MOVIMIENTO y RESURTIDO; ignorada en RECEPCION.
  ubicacionInicial: z.string().max(120).optional(),
})

// POST /api/montacargas - crea el registro y ARRANCA EL RELOJ (horaInicio la
// sella el servidor, no el cliente: es la medicion de productividad que
// sustituye al NOW() volatil de la planilla de Excel).
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioMontacargas(actor.role)

  const parsed = createSchema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const { tipo } = parsed.data

  // Un solo registro abierto por operario Y POR TIPO. A diferencia de
  // Exportaciones NO se auto-cierra el anterior: cerrarlo sin ubicacion final
  // dejaria el registro sin el dato que le da sentido. Se devuelve el abierto
  // para que la UI salte al paso de ubicar en vez de duplicar.
  const abierto = await prisma.movimientoMontacargas.findFirst({
    where: { creadoPorId: actor.id, tipo, horaFinalizacion: null, deletedAt: null },
    include: MOVIMIENTO_INCLUDE,
    orderBy: [{ horaInicio: 'desc' }],
  })
  if (abierto) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Ya tienes un registro en curso. Asignale la ubicacion final antes de crear otro.',
      data: { code: 'MOVIMIENTO_ABIERTO', movimiento: mapMovimientoMontacargas(abierto) },
    })
  }

  const producto = await resolverProducto(parsed.data.codigo)
  if (!producto) {
    throw createError({ statusCode: 404, statusMessage: 'PLU o codigo de barras no encontrado en el maestro' })
  }
  const descripcion = producto.descripcion?.trim()
  if (!descripcion) {
    throw createError({ statusCode: 400, statusMessage: 'El producto no tiene descripcion en el maestro' })
  }

  // El maestro manda cuando tiene el dato; si no, se exige que lo mande el
  // cliente y se marca como manual para poder completar el catalogo despues.
  const unidadesPorCaja = producto.unidadesPorCaja ?? parsed.data.unidadesPorCaja ?? 0
  const unidadesManuales = producto.unidadesPorCaja == null
  const hayReguero = parsed.data.hayReguero ?? false
  const unidadesSueltas = parsed.data.unidadesSueltas ?? 0

  const validation = validarCaptura({
    tipo,
    codigo: parsed.data.codigo,
    cajas: parsed.data.cajas,
    unidadesPorCaja,
    hayReguero,
    unidadesSueltas,
    ubicacionInicial: parsed.data.ubicacionInicial,
  })
  if (validation) throw createError({ statusCode: 400, statusMessage: validation })

  const now = new Date()
  const created = await prisma.movimientoMontacargas.create({
    data: {
      tipo,
      plu: producto.plu,
      ean: producto.ean,
      descripcion,
      cajas: parsed.data.cajas,
      unidadesPorCaja,
      unidadesManuales,
      hayReguero,
      unidadesSueltas,
      cantidadTotal: calcularCantidadTotal(parsed.data.cajas, unidadesPorCaja, unidadesSueltas),
      ubicacionInicial: requiereUbicacionInicial(tipo)
        ? normalizarUbicacion(parsed.data.ubicacionInicial)
        : null,
      fecha: todayBogota(now),
      horaInicio: now,
      creadoPorId: actor.id,
    },
    include: MOVIMIENTO_INCLUDE,
  })

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: 'CREATE',
      module: 'control-montacargas',
      recordId: created.id,
      details: `${tipo} PLU ${created.plu} - ${created.cajas} cajas, ${created.unidadesSueltas} sueltas`,
    },
  }).catch(() => {})

  setResponseStatus(event, 201)
  return { success: true, data: mapMovimientoMontacargas(created) }
})
