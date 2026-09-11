import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { assertVePendientes, avisar, puedeMontarResurtido } from '../../../utils/resurtido'
import { puedeBorrarPendiente } from '../../../utils/resurtidoCalc'

/**
 * DELETE /api/pendientes/:id — borrado logico (deleted_at).
 *
 * Sin asignar lo borran quien lo pidio, almacenamiento con el permiso por
 * persona (Felipe Ossa, Eduardo Zurita) y el administrador; asignado o en curso,
 * solo el administrador. Uno ya ubicado no: es historia y cuenta en los
 * indicadores del operario (ver puedeBorrarPendiente).
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

  const permitido = puedeBorrarPendiente({
    estado: p.estado,
    esAdmin: actor.role === 'ADMIN',
    tienePermisoMontar: await puedeMontarResurtido(actor.id),
    esQuienLoPidio: p.solicitadoPorId === actor.id,
  })
  if (!permitido) {
    const asignado = p.estado === 'ASIGNADO' || p.estado === 'EN_CURSO'
    throw createError({
      statusCode: p.estado === 'COMPLETADO' ? 409 : 403,
      statusMessage: p.estado === 'COMPLETADO'
        ? 'Ese pendiente ya se ubico: no se puede borrar'
        : asignado
          ? 'Un pendiente asignado solo lo puede borrar el administrador'
          : 'No puedes borrar este pendiente',
    })
  }

  await prisma.$transaction(async (tx) => {
    await tx.pendienteGourmet.update({ where: { id }, data: { deletedAt: new Date() } })

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
        descripcion: `${p.descripcion} (${p.unidadesSolicitadas} unidades)`,
        enlace: '/dashboard/pendientes',
      })
    }
  })

  await prisma.activityLog.create({
    data: {
      userId: actor.id, action: 'DELETE', module: 'pendientes',
      recordId: id, details: `Pendiente borrado: PLU ${p.plu} x${p.unidadesSolicitadas}`,
    },
  }).catch(() => {})

  return { success: true }
})
