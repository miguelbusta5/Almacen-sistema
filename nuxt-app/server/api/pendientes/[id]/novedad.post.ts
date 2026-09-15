import { defineOperacionAlmacenHandler } from '../../../utils/operacionAlmacen'
import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapPendiente } from '../../../utils/mapRow'
import {
  assertEjecutor, avisar, cerrarTramoPendiente, idsAlmacenamiento, PENDIENTE_INCLUDE,
} from '../../../utils/resurtido'
import {
  devuelveASolicitante, NOVEDAD_PENDIENTE_LABEL,
} from '../../../utils/resurtidoCalc'

const schema = z.object({
  tipo: z.enum(['SIN_EXISTENCIAS', 'EN_INSPECCION', 'AREA_MUEBLES', 'EN_PASILLO']),
})

/**
 * POST /api/pendientes/:id/novedad - el operario no puede bajarlo y dice por que.
 *
 * El area de muebles es la unica que se DEVUELVE a quien lo pidio: no es un
 * problema del deposito, se pidio al area equivocada. El resto -sin
 * existencias, en inspeccion, en pasillo- son problemas de almacenamiento y el
 * pendiente se queda en rojo para que alguien decida.
 *
 * En los dos casos sale de la lista del operario y el reloj se descarta: no
 * pudo hacerlo, y contarle tiempo por eso seria medirle algo que no hizo.
 */
export default defineOperacionAlmacenHandler(async (event) => {
  const actor = await requireAuth(event)
  assertEjecutor(actor.role)

  const id = getRouterParam(event, 'id')!
  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Elige que novedad encontraste' })
  }
  const tipo = parsed.data.tipo

  const p = await prisma.pendienteGourmet.findUnique({
    where: { id },
    select: {
      estado: true, deletedAt: true, operarioId: true, descripcion: true,
      solicitadoPorId: true,
    },
  })
  if (!p || p.deletedAt) throw createError({ statusCode: 404, statusMessage: 'Pendiente no encontrado' })
  if (p.operarioId !== actor.id) {
    throw createError({ statusCode: 403, statusMessage: 'Ese pendiente es de otro operario' })
  }
  if (p.estado === 'COMPLETADO') {
    throw createError({ statusCode: 409, statusMessage: 'Ese pendiente ya se ubico' })
  }

  const etiqueta = NOVEDAD_PENDIENTE_LABEL[tipo]
  const devuelve = devuelveASolicitante(tipo)
  const now = new Date()

  const actualizado = await prisma.$transaction(async (tx) => {
    // El reloj se para: el tramo de quien lo tenia queda cerrado aqui.
    await cerrarTramoPendiente(tx, id, now)
    await tx.pendienteGourmet.update({
      where: { id },
      data: devuelve
        ? {
            estado: 'DEVUELTO',
            devueltoPorId: actor.id,
            devueltoAt: now,
            motivoDevolucion: etiqueta,
            horaInicio: null,
            horaFin: null,
          }
        : {
            estado: 'NOVEDAD',
            tipoNovedad: tipo,
            novedadPorId: actor.id,
            novedadAt: now,
            horaInicio: null,
            horaFin: null,
          },
    })

    // Muebles se entera quien lo pidio; el resto lo tiene que resolver
    // almacenamiento, pero quien lo pidio tambien quiere saber que se trabo.
    await avisar(tx, [p.solicitadoPorId, ...(await idsAlmacenamiento())], {
      tipo: devuelve ? 'PENDIENTE_DEVUELTO' : 'PENDIENTE_NOVEDAD',
      titulo: devuelve ? 'Pendiente devuelto' : 'Novedad en un pendiente',
      descripcion: `${actor.name ?? 'El operario'}: ${p.descripcion} - ${etiqueta}`,
      enlace: '/dashboard/pendientes',
    })

    return tx.pendienteGourmet.findUniqueOrThrow({ where: { id }, include: PENDIENTE_INCLUDE })
  })

  await prisma.activityLog.create({
    data: {
      userId: actor.id, action: 'UPDATE', module: 'pendientes',
      recordId: id, details: `Novedad en pendiente: ${etiqueta}`,
    },
  }).catch(() => {})

  return { success: true, data: mapPendiente(actualizado) }
})
