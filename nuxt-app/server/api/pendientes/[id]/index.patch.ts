import { defineOperacionAlmacenHandler } from '../../../utils/operacionAlmacen'
import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapPendiente } from '../../../utils/mapRow'
import { avisar, descripcionMaestro, PENDIENTE_INCLUDE } from '../../../utils/resurtido'
import { puedeEditarPendiente, validarSolicitudPendiente } from '../../../utils/resurtidoCalc'
import { normalizePlu } from '../../../utils/exportacionesCalc'
import { resolverPluMaestro } from '../../../utils/codigoProducto'

const schema = z.object({
  plu: z.string().min(1).max(100),
  unidadesSolicitadas: z.number().int(),
  observacion: z.string().max(500).nullable().optional(),
})

/**
 * PATCH /api/pendientes/:id - quien lo pidio lo corrige.
 *
 * Se puede corregir aunque YA ESTE ASIGNADO: el operario todavia no lo ha
 * bajado, asi que cambiar la cantidad o el producto sigue sirviendo. Lo que no
 * se toca es un pendiente ya ubicado: eso es historia, y cambiarlo falsearia lo
 * que de verdad paso.
 *
 * Si ya tenia operario se le avisa: puede estar caminando hacia el sitio con la
 * cifra vieja en la cabeza.
 */
export default defineOperacionAlmacenHandler(async (event) => {
  const actor = await requireAuth(event)

  const id = getRouterParam(event, 'id')!
  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const d = parsed.data

  const p = await prisma.pendienteGourmet.findUnique({
    where: { id },
    select: {
      estado: true, deletedAt: true, solicitadoPorId: true, operarioId: true,
      plu: true, unidadesSolicitadas: true,
    },
  })
  if (!p || p.deletedAt) throw createError({ statusCode: 404, statusMessage: 'Pendiente no encontrado' })

  // Lo corrige quien lo pidio. Nadie mas: el pendiente es su peticion.
  if (p.solicitadoPorId !== actor.id) {
    throw createError({ statusCode: 403, statusMessage: 'Solo puedes corregir los pendientes que pediste' })
  }
  if (!puedeEditarPendiente(p.estado)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Ese pendiente ya se ubico: no se puede cambiar',
    })
  }

  const plu = await resolverPluMaestro(normalizePlu(d.plu))
  const descripcion = await descripcionMaestro(prisma, plu)
  const error = validarSolicitudPendiente({
    plu, descripcion: descripcion ?? '', unidadesSolicitadas: d.unidadesSolicitadas,
  })
  if (error) throw createError({ statusCode: 400, statusMessage: error })

  const cambio = p.plu !== plu || p.unidadesSolicitadas !== d.unidadesSolicitadas

  const actualizado = await prisma.$transaction(async (tx) => {
    await tx.pendienteGourmet.update({
      where: { id },
      data: {
        plu,
        descripcion: descripcion!,
        unidadesSolicitadas: d.unidadesSolicitadas,
        observacion: d.observacion ?? null,
      },
    })

    if (cambio && p.operarioId) {
      await avisar(tx, [p.operarioId], {
        tipo: 'PENDIENTE_CORREGIDO',
        titulo: 'Cambio en un pendiente asignado',
        descripcion: `Ahora son ${d.unidadesSolicitadas} de ${descripcion}`,
        enlace: '/dashboard/resurtido',
      })
    }

    return tx.pendienteGourmet.findUniqueOrThrow({ where: { id }, include: PENDIENTE_INCLUDE })
  })

  await prisma.activityLog.create({
    data: {
      userId: actor.id, action: 'UPDATE', module: 'pendientes',
      recordId: id, details: `Pendiente corregido: PLU ${plu} x${d.unidadesSolicitadas}`,
    },
  }).catch(() => {})

  return { success: true, data: mapPendiente(actualizado) }
})
