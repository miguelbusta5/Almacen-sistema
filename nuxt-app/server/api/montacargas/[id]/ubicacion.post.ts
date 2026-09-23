import { defineOperacionAlmacenHandler } from '../../../utils/operacionAlmacen'
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
import { avisar } from '../../../utils/resurtido'
import {
  normalizarUbicacion, puedeRecibirTraspaso, quienPasoElPlu, repartirEnCajas, validarCantidades,
  validarUbicacion, validarUnidadesAlmacenadas,
} from '../../../utils/montacargasCalc'

const schema = z.object({
  // No hace falta cuando no cupo nada: el total vuelve sin ubicacion.
  ubicacionFinal: z.string().max(120).optional(),
  // Cuantas unidades cupieron de verdad. Opcional: si no viene, se asume que se
  // almaceno todo, que es el caso normal.
  unidadesAlmacenadas: z.number().int().optional(),
  // A quien vuelve lo que no cupo. Lo elige quien cierra, para que no haya
  // dudas de quien tiene que ubicarlo; si no viene, a quien le paso el PLU.
  devolverAId: z.string().min(1).max(60).optional(),
})

// POST /api/montacargas/:id/ubicacion - asigna el deposito final y PARA EL RELOJ.
// Asignar la ubicacion final es lo que cierra el registro: no hay un "finalizar"
// aparte.
//
// Si no cupo todo, el registro se cierra con lo que SI se almaceno y el resto
// nace como un registro nuevo enlazado a este, en manos de QUIEN LE PASO EL PLU
// y con el reloj corriendo de nuevo: el sobrante sigue siendo trabajo pendiente
// hasta que alguien le de una ubicacion. Si paso por varias manos, vuelve al
// ultimo que se lo entrego, no a quien lo abrio (ver quienPasoElPlu).
//
// Si no cupo NADA (0 unidades), no se cierra nada: el registro entero vuelve a
// quien elija el ayudante, con el reloj corriendo. Se cierra el tramo del
// ayudante y se abre el de quien lo recibe, igual que un traspaso.
export default defineOperacionAlmacenHandler(async (event) => {
  const actor = await requireAuth(event)
  assertUsuarioMontacargas(actor.role)

  const id = getRouterParam(event, 'id')!
  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }

  const ubicacionFinal = normalizarUbicacion(parsed.data.ubicacionFinal ?? '')
  const devuelveTodo = parsed.data.unidadesAlmacenadas === 0
  if (!devuelveTodo) {
    const validation = validarUbicacion(ubicacionFinal)
    if (validation) throw createError({ statusCode: 400, statusMessage: validation })
  }

  const record = await prisma.movimientoMontacargas.findUnique({
    where: { id },
    select: {
      responsableId: true, estado: true, deletedAt: true, tipo: true,
      cajas: true, unidadesPorCaja: true, hayReguero: true, unidadesSueltas: true,
      cantidadTotal: true, plu: true, ean: true, descripcion: true,
      unidadesManuales: true, ubicacionInicial: true, numeroPedido: true, creadoPorId: true,
      tramos: { select: { usuarioId: true, orden: true, usuario: { select: { name: true } } } },
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
  const paso = quienPasoElPlu(record.tramos, record.responsableId)
  let devolverA = paso?.usuarioId ?? record.creadoPorId
  let devolverANombre: string | null = paso?.usuario.name ?? null

  if (devuelveTodo && devolverA === record.responsableId && !parsed.data.devolverAId) {
    throw createError({ statusCode: 400, statusMessage: 'Elige a quien le devuelves las unidades' })
  }

  if (sobrante > 0 && parsed.data.devolverAId) {
    // Quien lo cierra no se lo devuelve a si mismo: si le cupiera, lo habria
    // almacenado.
    if (parsed.data.devolverAId === record.responsableId) {
      throw createError({ statusCode: 400, statusMessage: 'El sobrante tiene que volver a otra persona' })
    }
    const destino = await prisma.user.findFirst({
      where: { id: parsed.data.devolverAId, active: true },
      select: { id: true, name: true, role: true },
    })
    // Las mismas personas a las que se puede pasar un PLU: quien almacena.
    if (!destino || !puedeRecibirTraspaso(destino.role)) {
      throw createError({ statusCode: 400, statusMessage: 'Esa persona no puede recibir el sobrante' })
    }
    devolverA = destino.id
    devolverANombre = destino.name
  }

  const now = new Date()

  // No cupo nada: el registro entero vuelve de manos, sin cerrarse.
  if (devuelveTodo) {
    const devuelto = await prisma.$transaction(async (tx) => {
      const orden = await cerrarTramoAbierto(tx, id, now)
      await abrirTramo(tx, id, devolverA, now, orden + 1)
      await tx.movimientoMontacargas.update({
        where: { id },
        data: { responsableId: devolverA, actualizadoPorId: actor.id },
      })
      await avisar(tx, [devolverA], {
        tipo: 'SOBRANTE_DEVUELTO',
        titulo: 'Te devolvieron un PLU completo',
        descripcion: `${record.cantidadTotal} de ${record.descripcion}: no cupo ninguna, te toca ubicarlas`,
        enlace: record.tipo === 'RESURTIDO' ? '/dashboard/resurtido' : '/dashboard/control-montacargas',
      })
      return tx.movimientoMontacargas.findUniqueOrThrow({ where: { id }, include: MOVIMIENTO_INCLUDE })
    })

    await prisma.activityLog.create({
      data: {
        userId: actor.id, action: 'UPDATE', module: 'control-montacargas', recordId: id,
        details: `No cupo ninguna: ${record.cantidadTotal} unidades devueltas a ${devolverANombre ?? 'quien lo paso'}`,
      },
    }).catch(() => {})

    return {
      success: true,
      data: mapMovimientoMontacargas(devuelto),
      sobrante: { id, unidades: record.cantidadTotal, responsableNombre: devolverANombre },
      devueltoCompleto: true,
    }
  }

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
          // El sobrante es del mismo contenedor: conserva su pedido.
          numeroPedido: record.numeroPedido,
          fecha: todayBogota(now),
          horaInicio: now,
          origenId: id,
          // Vuelve a quien eligio quien lo cerro (por defecto, quien se lo
          // paso): es quien elige donde cabe el resto. Queda como suyo.
          creadoPorId: devolverA,
          responsableId: devolverA,
          actualizadoPorId: actor.id,
        },
        select: { id: true },
      })
      // Reloj nuevo desde ya: el sobrante es trabajo que sigue corriendo.
      await abrirTramo(tx, creado.id, devolverA, now, 1)
      nuevoId = creado.id
      // Le llega el aviso aunque no este mirando la bandeja.
      if (devolverA !== actor.id) {
        await avisar(tx, [devolverA], {
          tipo: 'SOBRANTE_DEVUELTO',
          titulo: 'Te devolvieron un sobrante',
          descripcion: `${sobrante} de ${record.descripcion} no cupieron: te toca ubicarlas`,
          enlace: record.tipo === 'RESURTIDO' ? '/dashboard/resurtido' : '/dashboard/control-montacargas',
        })
      }
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
          + `${sobrante} devueltas a ${devolverANombre ?? 'quien lo abrio'} (registro ${sobranteId})`
        : `Ubicacion final asignada: ${ubicacionFinal}`,
    },
  }).catch(() => {})

  return {
    success: true,
    data: mapMovimientoMontacargas(updated),
    // La UI lo usa para avisar de que el sobrante volvio al montacarguista.
    sobrante: sobranteId
      ? { id: sobranteId, unidades: sobrante, responsableNombre: devolverANombre }
      : null,
  }
})
