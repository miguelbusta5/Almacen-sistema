import { defineOperacionAlmacenHandler } from '../../utils/operacionAlmacen'
import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { mapPendiente } from '../../utils/mapRow'
import {
  avisar, descripcionMaestro, idsAlmacenamiento, PENDIENTE_INCLUDE,
} from '../../utils/resurtido'
import { esSolicitante, validarSolicitudPendiente } from '../../utils/resurtidoCalc'
import { normalizePlu, todayBogota } from '../../utils/exportacionesCalc'
import { buscarPendienteSumable, resurtidoDelPlu, unirObservaciones } from '../../utils/pendientesSolicitud'
import { calcularSugerenciaPendiente } from '../../utils/sugerenciaPendiente'

const schema = z.object({
  plu: z.string().min(1).max(100),
  unidadesSolicitadas: z.number().int(),
  observacion: z.string().max(500).nullable().optional(),
  // Confirmacion de quien pide cuando el PLU tiene un resurtido abierto o
  // reciente: la pantalla la pide y el servidor la exige.
  confirmarResurtido: z.boolean().optional(),
})

/**
 * POST /api/pendientes - operaciones gourmet pide mercancia a picking.
 *
 * No arranca ningun reloj de trabajo: lo que empieza a correr es la ESPERA, que
 * es otra cosa y se mide desde solicitadoAt. El reloj de la tarea arranca cuando
 * el operario escanea el PLU.
 *
 * Si ya hay un pendiente del mismo PLU que nadie ha empezado, NO se crea otro:
 * se suman las unidades a ese (y a su tarea de resurtido, si va dentro de una
 * que tampoco se ha empezado). Ver buscarPendienteSumable.
 */
export default defineOperacionAlmacenHandler(async (event) => {
  const actor = await requireAuth(event)
  if (!esSolicitante(actor.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Solo operaciones gourmet solicita pendientes' })
  }

  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const d = parsed.data

  const plu = normalizePlu(d.plu)
  const descripcion = await descripcionMaestro(prisma, plu)

  const error = validarSolicitudPendiente({
    plu,
    descripcion: descripcion ?? '',
    unidadesSolicitadas: d.unidadesSolicitadas,
  })
  if (error) throw createError({ statusCode: 400, statusMessage: error })

  const now = new Date()

  // Resurtido abierto o de las ultimas 2 horas: hay que confirmar.
  const resurtido = await resurtidoDelPlu(prisma, plu, now)
  if ((resurtido.enCurso.length || resurtido.reciente.length) && !d.confirmarResurtido) {
    throw createError({
      statusCode: 409,
      statusMessage: resurtido.enCurso.length
        ? 'Este PLU tiene un resurtido en curso: confirma si igual lo solicitas'
        : 'Este PLU se resurtio en las ultimas 2 horas: confirma si igual lo solicitas',
    })
  }

  // ¿Se suma a uno que nadie ha empezado?
  const sumado = await prisma.$transaction(async (tx) => {
    const existente = await buscarPendienteSumable(tx, plu)
    if (!existente) return null
    const total = existente.unidadesSolicitadas + d.unidadesSolicitadas
    if (existente.tareaResurtidoId && existente.tareaResurtido) {
      await tx.tareaResurtido.update({
        where: { id: existente.tareaResurtidoId },
        data: { unidadesPendientes: existente.tareaResurtido.unidadesPendientes + d.unidadesSolicitadas },
      })
    }
    // Asignado sin resurtido: la altura sugerida se recalcula con el total.
    const sugerencia = existente.estado === 'ASIGNADO' && !existente.tareaResurtidoId
      ? await calcularSugerenciaPendiente(tx, { id: existente.id, plu, unidadesSolicitadas: total }, now)
      : undefined
    await tx.pendienteGourmet.update({
      where: { id: existente.id },
      data: {
        unidadesSolicitadas: total,
        observacion: unirObservaciones(existente.observacion, d.observacion),
        ...(sugerencia && { sugerencia: JSON.parse(JSON.stringify(sugerencia)) as Prisma.InputJsonValue }),
      },
    })
    await avisar(tx, await idsAlmacenamiento(), {
      tipo: 'PENDIENTE_AUMENTADO',
      titulo: 'Pendiente aumentado',
      descripcion: `${actor.name ?? 'Gourmet'} sumo ${d.unidadesSolicitadas} de ${existente.descripcion}: ahora son ${total}`,
      enlace: '/dashboard/pendientes',
    })
    if (existente.operarioId) {
      await avisar(tx, [existente.operarioId], {
        tipo: 'PENDIENTE_CORREGIDO',
        titulo: 'Cambio en un pendiente asignado',
        descripcion: `Ahora son ${total} de ${existente.descripcion}`,
        enlace: '/dashboard/resurtido',
      })
    }
    return tx.pendienteGourmet.findUniqueOrThrow({ where: { id: existente.id }, include: PENDIENTE_INCLUDE })
  })
  if (sumado) {
    await prisma.activityLog.create({
      data: {
        userId: actor.id, action: 'UPDATE', module: 'pendientes',
        recordId: sumado.id, details: `Solicitud sumada al pendiente PLU ${plu}: +${d.unidadesSolicitadas}, total ${sumado.unidadesSolicitadas}`,
      },
    }).catch(() => {})
    return { success: true, data: mapPendiente(sumado), sumado: true }
  }

  const creado = await prisma.$transaction(async (tx) => {
    const p = await tx.pendienteGourmet.create({
      data: {
        plu,
        descripcion: descripcion!,
        unidadesSolicitadas: d.unidadesSolicitadas,
        observacion: d.observacion ?? null,
        solicitadoPorId: actor.id,
        solicitadoAt: now,
        fecha: todayBogota(now),
      },
      select: { id: true },
    })

    // Almacenamiento tiene que enterarse para poder repartirlo.
    await avisar(tx, await idsAlmacenamiento(), {
      tipo: 'PENDIENTE_SOLICITADO',
      titulo: 'Pendiente solicitado',
      descripcion: `${actor.name ?? 'Gourmet'} pidio ${d.unidadesSolicitadas} de ${descripcion}`,
      enlace: '/dashboard/pendientes',
    })

    return tx.pendienteGourmet.findUniqueOrThrow({ where: { id: p.id }, include: PENDIENTE_INCLUDE })
  })

  await prisma.activityLog.create({
    data: {
      userId: actor.id, action: 'CREATE', module: 'pendientes',
      recordId: creado.id, details: `Pendiente PLU ${plu} x${d.unidadesSolicitadas}`,
    },
  }).catch(() => {})

  return { success: true, data: mapPendiente(creado), sumado: false }
})
