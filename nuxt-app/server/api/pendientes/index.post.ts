import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { mapPendiente } from '../../utils/mapRow'
import {
  avisar, descripcionMaestro, idsAlmacenamiento, PENDIENTE_INCLUDE,
} from '../../utils/resurtido'
import { esSolicitante, validarSolicitudPendiente } from '../../utils/resurtidoCalc'
import { normalizePlu, todayBogota } from '../../utils/exportacionesCalc'

const schema = z.object({
  plu: z.string().min(1).max(100),
  unidadesSolicitadas: z.number().int(),
  observacion: z.string().max(500).nullable().optional(),
})

/**
 * POST /api/pendientes - operaciones gourmet pide mercancia a picking.
 *
 * No arranca ningun reloj de trabajo: lo que empieza a correr es la ESPERA, que
 * es otra cosa y se mide desde solicitadoAt. El reloj de la tarea arranca cuando
 * el operario escanea el PLU.
 */
export default defineEventHandler(async (event) => {
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

  return { success: true, data: mapPendiente(creado) }
})
