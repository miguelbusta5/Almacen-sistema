import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapMovimientoMontacargas } from '../../../utils/mapRow'
import {
  abrirTramo, assertUsuarioMontacargas, cerrarTramoAbierto, esResponsableOGestor,
  MOVIMIENTO_INCLUDE,
} from '../../../utils/montacargas'
import { todayBogota } from '../../../utils/exportacionesCalc'
import {
  normalizarUbicacion, repartirEnCajas, validarCantidades, validarUbicacion,
  validarUnidadesAlmacenadas,
} from '../../../utils/montacargasCalc'

const schema = z.object({
  ubicacionFinal: z.string().min(1).max(120),
  // Cuantas unidades cupieron de verdad. Opcional: si no viene, se asume que se
  // almaceno todo, que es el caso normal.
  unidadesAlmacenadas: z.number().int().optional(),
})

// POST /api/montacargas/:id/ubicacion - asigna el deposito final y PARA EL RELOJ.
// Asignar la ubicacion final es lo que cierra el registro: no hay un "finalizar"
// aparte.
//
// Si no cupo todo, el registro se cierra con lo que SI se almaceno y el resto
// nace como un registro nuevo enlazado a este, en manos del montacarguista que
// abrio el PLU y con el reloj corriendo de nuevo: el sobrante sigue siendo
// trabajo pendiente hasta que alguien le de una ubicacion.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioMontacargas(actor.role)

  const id = getRouterParam(event, 'id')!
  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }

  const ubicacionFinal = normalizarUbicacion(parsed.data.ubicacionFinal)
  const validation = validarUbicacion(ubicacionFinal)
  if (validation) throw createError({ statusCode: 400, statusMessage: validation })

  const record = await prisma.movimientoMontacargas.findUnique({
    where: { id },
    select: {
      responsableId: true, estado: true, deletedAt: true, tipo: true,
      cajas: true, unidadesPorCaja: true, hayReguero: true, unidadesSueltas: true,
      cantidadTotal: true, plu: true, ean: true, descripcion: true,
      unidadesManuales: true, ubicacionInicial: true, creadoPorId: true,
    },
  })
  if (!record || record.deletedAt) {
    throw createError({ statusCode: 404, statusMessage: 'Registro no encontrado' })
  }
  if (!esResponsableOGestor(actor, record)) {
    throw createError({ statusCode: 403, statusMessage: 'Solo puedes cerrar los registros que tienes en la mano' })
  }
  if (record.estado === 'CERRADO') {
    throw createError({ statusCode: 409, statusMessage: 'El registro ya esta cerrado' })
  }
  if (record.estado === 'NOVEDAD') {
    throw createError({
      statusCode: 409,
      statusMessage: 'El registro tiene una novedad sin resolver: primero hay que verificarlo',
    })
  }

  // Las cantidades se exigen aqui y no al abrir: al abrir solo se tiene el PLU.
  const faltan = validarCantidades(record)
  if (faltan) throw createError({ statusCode: 400, statusMessage: faltan })

  const almacenadas = parsed.data.unidadesAlmacenadas ?? record.cantidadTotal
  const errCantidad = validarUnidadesAlmacenadas(almacenadas, record.cantidadTotal)
  if (errCantidad) throw createError({ statusCode: 400, statusMessage: errCantidad })

  const sobrante = record.cantidadTotal - almacenadas

  const now = new Date()
  const { updated, sobranteId } = await prisma.$transaction(async (tx) => {
    await cerrarTramoAbierto(tx, id, now)

    // El registro pasa a valer lo que realmente se almaceno en esa ubicacion, y
    // se reexpresa en cajas + sueltas para no romper la invariante del total.
    const reparto = repartirEnCajas(almacenadas, record.unidadesPorCaja)
    await tx.movimientoMontacargas.update({
      where: { id },
      data: {
        ubicacionFinal,
        estado: 'CERRADO',
        horaFinalizacion: now,
        actualizadoPorId: actor.id,
        ...(sobrante > 0 && {
          cajas: reparto.cajas,
          unidadesSueltas: reparto.unidadesSueltas,
          hayReguero: reparto.unidadesSueltas > 0,
          cantidadTotal: almacenadas,
        }),
      },
    })

    let nuevoId: string | null = null
    if (sobrante > 0) {
      const restante = repartirEnCajas(sobrante, record.unidadesPorCaja)
      const creado = await tx.movimientoMontacargas.create({
        data: {
          tipo: record.tipo,
          estado: 'EN_CURSO',
          plu: record.plu,
          ean: record.ean,
          descripcion: record.descripcion,
          cajas: restante.cajas,
          unidadesPorCaja: record.unidadesPorCaja,
          unidadesManuales: record.unidadesManuales,
          hayReguero: restante.unidadesSueltas > 0,
          unidadesSueltas: restante.unidadesSueltas,
          cantidadTotal: sobrante,
          ubicacionInicial: record.ubicacionInicial,
          fecha: todayBogota(now),
          horaInicio: now,
          origenId: id,
          // Vuelve a quien abrio el PLU: es el montacarguista que lo tenia y el
          // que elige donde cabe el resto.
          creadoPorId: record.creadoPorId,
          responsableId: record.creadoPorId,
          actualizadoPorId: actor.id,
        },
        select: { id: true },
      })
      // Reloj nuevo desde ya: el sobrante es trabajo que sigue corriendo.
      await abrirTramo(tx, creado.id, record.creadoPorId, now, 1)
      nuevoId = creado.id
    }

    return {
      updated: await tx.movimientoMontacargas.findUniqueOrThrow({
        where: { id },
        include: MOVIMIENTO_INCLUDE,
      }),
      sobranteId: nuevoId,
    }
  })

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: 'UPDATE',
      module: 'control-montacargas',
      recordId: id,
      details: sobranteId
        ? `Ubicacion final ${ubicacionFinal} con ${almacenadas} de ${record.cantidadTotal} unidades; `
          + `${sobrante} devueltas al montacarguista (registro ${sobranteId})`
        : `Ubicacion final asignada: ${ubicacionFinal}`,
    },
  }).catch(() => {})

  return {
    success: true,
    data: mapMovimientoMontacargas(updated),
    // La UI lo usa para avisar de que el sobrante volvio al montacarguista.
    sobrante: sobranteId ? { id: sobranteId, unidades: sobrante } : null,
  }
})
