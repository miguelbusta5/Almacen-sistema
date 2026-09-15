import { defineOperacionAlmacenHandler } from '../../utils/operacionAlmacen'
import { defineEventHandler, readBody, setResponseStatus, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { mapMovimientoMontacargas } from '../../utils/mapRow'
import { todayBogota } from '../../utils/exportacionesCalc'
import { assertUsuarioMontacargas, MOVIMIENTO_INCLUDE, resolverProducto } from '../../utils/montacargas'
import {
  normalizarUbicacion, puedeCrearMovimiento,
  requiereUbicacionInicial, validarApertura,
} from '../../utils/montacargasCalc'

const createSchema = z.object({
  tipo: z.enum(['RECEPCION', 'MOVIMIENTO', 'RESURTIDO']),
  // PLU o EAN: lo que haya leido la pistola o tecleado el operario.
  codigo: z.string().min(1).max(100),
  // Obligatoria en MOVIMIENTO y RESURTIDO; ignorada en RECEPCION.
  ubicacionInicial: z.string().max(120).optional(),
})

// POST /api/montacargas - abre el registro y ARRANCA EL RELOJ.
//
// El reloj arranca al digitar el PLU, no al completar el formulario: las
// cantidades llegan despues por PATCH. horaInicio la sella el servidor, que es
// lo que hace confiable la medicion (la planilla de Excel usaba un NOW() volatil).
export default defineOperacionAlmacenHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioMontacargas(actor.role)
  if (!puedeCrearMovimiento(actor.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Tu rol solo recibe PLUs, no los inicia' })
  }

  const parsed = createSchema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const { tipo } = parsed.data

  const validation = validarApertura(parsed.data)
  if (validation) throw createError({ statusCode: 400, statusMessage: validation })

  // Varios PLUs en curso a la vez, en todos los flujos: el montacarguista baja
  // varias estibas seguidas y cada una lleva su propio reloj. Los indicadores
  // cuentan el tiempo de la persona como reloj de pared, asi que tenerlos
  // abiertos a la vez no le infla el tiempo trabajado.

  const producto = await resolverProducto(parsed.data.codigo)
  if (!producto) {
    throw createError({ statusCode: 404, statusMessage: 'PLU o codigo de barras no encontrado en el maestro' })
  }
  const descripcion = producto.descripcion?.trim()
  if (!descripcion) {
    throw createError({ statusCode: 400, statusMessage: 'El producto no tiene descripcion en el maestro' })
  }

  const now = new Date()
  const created = await prisma.$transaction(async (tx) => {
    const mov = await tx.movimientoMontacargas.create({
      data: {
        tipo,
        estado: 'EN_CURSO',
        plu: producto.plu,
        ean: producto.ean,
        descripcion,
        // Las cantidades arrancan en cero: se completan sin parar el reloj.
        cajas: 0,
        unidadesPorCaja: producto.unidadesPorCaja ?? 0,
        unidadesManuales: producto.unidadesPorCaja == null,
        cantidadTotal: 0,
        ubicacionInicial: requiereUbicacionInicial(tipo)
          ? normalizarUbicacion(parsed.data.ubicacionInicial)
          : null,
        fecha: todayBogota(now),
        horaInicio: now,
        creadoPorId: actor.id,
        responsableId: actor.id,
      },
    })
    await tx.tramoMontacargas.create({
      data: { movimientoId: mov.id, usuarioId: actor.id, inicio: now, orden: 1 },
    })
    return tx.movimientoMontacargas.findUniqueOrThrow({
      where: { id: mov.id },
      include: MOVIMIENTO_INCLUDE,
    })
  })

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: 'CREATE',
      module: 'control-montacargas',
      recordId: created.id,
      details: `${tipo} PLU ${created.plu} - reloj iniciado`,
    },
  }).catch(() => {})

  setResponseStatus(event, 201)
  return { success: true, data: mapMovimientoMontacargas(created) }
})
