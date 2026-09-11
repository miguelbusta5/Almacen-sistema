import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { assertVePendientes, avisar, puedeMontarResurtido } from '../../../utils/resurtido'
import { puedeBorrarPendiente, validarMotivoBorrado } from '../../../utils/resurtidoCalc'

/**
 * DELETE /api/pendientes/:id — borrado logico (deleted_at).
 *
 * Sin asignar lo borran quien lo pidio, almacenamiento con el permiso por
 * persona (Felipe Ossa, Eduardo Zurita) y el administrador; asignado, en curso
 * o ya ubicado, solo el administrador. El ubicado ademas exige justificante
 * ({ motivo }): es historia y cuenta en los indicadores del operario, asi que
 * borrarlo tiene que quedar explicado (ver puedeBorrarPendiente).
 *
 * Si iba sumado a una tarea de resurtido que aun no se hizo, se le restan sus
 * unidades a esa tarea, y si era el ultimo pendiente que la hacia prioritaria,
 * deja de serlo: sin esto el operario bajaria unidades que ya nadie espera.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertVePendientes(actor.role)

  const id = getRouterParam(event, 'id')!
  const p = await prisma.pendienteGourmet.findUnique({
    where: { id },
    select: {
      estado: true, deletedAt: true, solicitadoPorId: true, operarioId: true,
      plu: true, descripcion: true, unidadesSolicitadas: true, tareaResurtidoId: true,
    },
  })
  if (!p || p.deletedAt) throw createError({ statusCode: 404, statusMessage: 'Pendiente no encontrado' })

  const body = (await readBody<{ motivo?: unknown }>(event).catch(() => null)) ?? {}

  const permitido = puedeBorrarPendiente({
    estado: p.estado,
    esAdmin: actor.role === 'ADMIN',
    tienePermisoMontar: await puedeMontarResurtido(actor.id),
    esQuienLoPidio: p.solicitadoPorId === actor.id,
  })
  if (!permitido) {
    throw createError({
      statusCode: 403,
      statusMessage: p.estado === 'COMPLETADO'
        ? 'Un pendiente ya ubicado solo lo puede borrar el administrador'
        : p.estado === 'ASIGNADO' || p.estado === 'EN_CURSO'
          ? 'Un pendiente asignado solo lo puede borrar el administrador'
          : 'No puedes borrar este pendiente',
    })
  }
  const errMotivo = validarMotivoBorrado(p.estado, body.motivo)
  if (errMotivo) throw createError({ statusCode: 400, statusMessage: errMotivo })
  const motivo = typeof body.motivo === 'string' && body.motivo.trim() ? body.motivo.trim() : null

  await prisma.$transaction(async (tx) => {
    await tx.pendienteGourmet.update({
      where: { id },
      data: { deletedAt: new Date(), borradoPorId: actor.id, motivoBorrado: motivo },
    })

    if (p.tareaResurtidoId) {
      const tarea = await tx.tareaResurtido.findUnique({
        where: { id: p.tareaResurtidoId },
        select: { estado: true, unidadesPendientes: true },
      })
      if (tarea && tarea.estado !== 'COMPLETADA') {
        const quedan = await tx.pendienteGourmet.count({
          where: { tareaResurtidoId: p.tareaResurtidoId, deletedAt: null },
        })
        await tx.tareaResurtido.update({
          where: { id: p.tareaResurtidoId },
          data: {
            unidadesPendientes: Math.max(0, tarea.unidadesPendientes - p.unidadesSolicitadas),
            ...(quedan === 0 && { prioridad: false }),
          },
        })
      }
    }

    // Quien lo tenia en su lista: puede ir ya camino del sitio.
    if (p.operarioId && ['ASIGNADO', 'EN_CURSO'].includes(p.estado) && p.operarioId !== actor.id) {
      await avisar(tx, [p.operarioId], {
        tipo: 'PENDIENTE_BORRADO',
        titulo: 'Se borro un pendiente que tenias',
        descripcion: `Ya no hay que bajar ${p.unidadesSolicitadas} de ${p.descripcion}`,
        enlace: '/dashboard/resurtido',
      })
    }
    // Quien lo pidio, si lo borro otra persona.
    if (p.solicitadoPorId !== actor.id) {
      await avisar(tx, [p.solicitadoPorId], {
        tipo: 'PENDIENTE_BORRADO',
        titulo: 'Se borro un pendiente tuyo',
        descripcion: `${p.descripcion} (${p.unidadesSolicitadas} unidades)${motivo ? `: ${motivo}` : ''}`,
        enlace: '/dashboard/pendientes',
      })
    }
  })

  await prisma.activityLog.create({
    data: {
      userId: actor.id, action: 'DELETE', module: 'pendientes',
      recordId: id,
      details: `Pendiente ${p.estado === 'COMPLETADO' ? 'ya ubicado ' : ''}borrado: PLU ${p.plu} x${p.unidadesSolicitadas}`
        + (motivo ? ` — motivo: ${motivo}` : ''),
    },
  }).catch(() => {})

  return { success: true }
})
