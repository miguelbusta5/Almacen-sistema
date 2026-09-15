import { createError } from 'h3'
import { prisma } from './prisma'
import { abrirTramo, cerrarTramoAbierto } from './montacargas'
import { abrirTramoTarea, abrirTramoPendiente, cerrarTramoTarea, cerrarTramoPendiente } from './resurtido'
import { puedeUsarMontacargas } from './montacargasCalc'

export function assertPuedePausar(role: string) {
  if (!puedeUsarMontacargas(role)) throw createError({ statusCode: 403, statusMessage: 'Sin acceso a pausas operativas' })
}

export async function iniciarPausa(usuarioId: string, motivo: 'ALIMENTACION' | 'CAMBIO_BATERIAS') {
  const activa = await prisma.pausaOperativa.findUnique({ where: { activaUsuarioId: usuarioId } })
  if (activa) throw createError({ statusCode: 409, statusMessage: 'Ya tienes una pausa activa; finalízala antes de iniciar otra' })

  const [movimientos, tareas, pendientes, recepciones] = await Promise.all([
    prisma.movimientoMontacargas.findMany({ where: { responsableId: usuarioId, estado: 'EN_CURSO', deletedAt: null }, select: { id: true } }),
    prisma.tareaResurtido.findMany({ where: { estado: 'EN_CURSO', montaje: { deletedAt: null }, OR: [{ responsableId: usuarioId }, { responsableId: null, montaje: { operarioId: usuarioId } }] }, select: { id: true } }),
    prisma.pendienteGourmet.findMany({ where: { operarioId: usuarioId, estado: 'EN_CURSO', deletedAt: null, tareaResurtidoId: null }, select: { id: true } }),
    prisma.recepcionContenedor.findMany({ where: { creadoPorId: usuarioId, estado: 'EN_CURSO', deletedAt: null }, select: { id: true } }),
  ])
  const inicio = new Date()
  const ids = (rows: { id: string }[]) => rows.map(r => r.id)
  const pausa = await prisma.pausaOperativa.create({ data: {
    usuarioId, activaUsuarioId: usuarioId, motivo, inicio,
    movimientos: ids(movimientos), tareas: ids(tareas), pendientes: ids(pendientes), recepciones: ids(recepciones),
  } })
  const data = { pausaId: pausa.id, pausaInicio: inicio }
  for (const r of movimientos) await cerrarTramoAbierto(prisma, r.id, inicio)
  for (const r of tareas) await cerrarTramoTarea(prisma, r.id, inicio)
  for (const r of pendientes) await cerrarTramoPendiente(prisma, r.id, inicio)
  await prisma.movimientoMontacargas.updateMany({ where: { id: { in: pausa.movimientos } }, data })
  await prisma.tareaResurtido.updateMany({ where: { id: { in: pausa.tareas } }, data })
  await prisma.pendienteGourmet.updateMany({ where: { id: { in: pausa.pendientes } }, data })
  await prisma.recepcionContenedor.updateMany({ where: { id: { in: pausa.recepciones } }, data })
  await prisma.activityLog.create({ data: { userId: usuarioId, action: 'UPDATE', module: 'pausas-operativas', recordId: pausa.id, details: `Inicio de pausa: ${motivo}` } })
  return pausa
}

export async function finalizarPausa(usuarioId: string, pausaId: string) {
  const pausa = await prisma.pausaOperativa.findUnique({ where: { activaUsuarioId: usuarioId } })
  // Exigir el id evita que un reintento antiguo finalice una pausa posterior.
  if (!pausa || pausa.id !== pausaId) throw createError({ statusCode: 409, statusMessage: 'Esa pausa ya no está activa. Actualiza la pantalla' })
  const fin = new Date()
  const segundos = Math.max(0, (fin.getTime() - pausa.inicio.getTime()) / 1000)
  await prisma.pausaOperativa.update({ where: { id: pausa.id }, data: { fin, activaUsuarioId: null } })
  const data = { pausaId: null, pausaInicio: null, pausaSegundos: { increment: segundos } }
  for (const id of pausa.movimientos) {
    const r = await prisma.movimientoMontacargas.findUnique({ where: { id } })
    if (r?.pausaId !== pausa.id) continue
    if (r.estado === 'EN_CURSO' && !r.deletedAt && r.responsableId === usuarioId) {
      const ultimo = await prisma.tramoMontacargas.findFirst({ where: { movimientoId: id }, orderBy: { orden: 'desc' } })
      await abrirTramo(prisma, id, usuarioId, fin, (ultimo?.orden ?? 0) + 1)
    }
  }
  for (const id of pausa.tareas) {
    const r = await prisma.tareaResurtido.findUnique({ where: { id }, include: { montaje: true } })
    if (r?.pausaId === pausa.id && r.estado === 'EN_CURSO' && !r.montaje.deletedAt && (r.responsableId ?? r.montaje.operarioId) === usuarioId) await abrirTramoTarea(prisma, id, usuarioId, fin)
  }
  for (const id of pausa.pendientes) {
    const r = await prisma.pendienteGourmet.findUnique({ where: { id } })
    if (r?.pausaId === pausa.id && r.estado === 'EN_CURSO' && !r.deletedAt && r.operarioId === usuarioId) await abrirTramoPendiente(prisma, id, usuarioId, fin)
  }
  await prisma.movimientoMontacargas.updateMany({ where: { pausaId: pausa.id }, data })
  await prisma.tareaResurtido.updateMany({ where: { pausaId: pausa.id }, data })
  await prisma.pendienteGourmet.updateMany({ where: { pausaId: pausa.id }, data })
  await prisma.recepcionContenedor.updateMany({ where: { pausaId: pausa.id }, data })
  await prisma.activityLog.create({ data: { userId: usuarioId, action: 'UPDATE', module: 'pausas-operativas', recordId: pausa.id, details: `Fin de pausa: ${pausa.motivo}; ${Math.round(segundos)} segundos` } })
}
