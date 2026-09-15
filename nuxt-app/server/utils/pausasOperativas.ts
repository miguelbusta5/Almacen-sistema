import { createError } from 'h3'
import { prisma } from './prisma'
import { abrirTramo, cerrarTramoAbierto } from './montacargas'
import { abrirTramoTarea, abrirTramoPendiente, cerrarTramoTarea, cerrarTramoPendiente } from './resurtido'
import { puedeUsarMontacargas } from './montacargasCalc'
import { puedePickear } from './mueblesCalc'

/** Horas maximas de un registro abierto para que una pausa lo detenga. */
export const HORAS_MAX_REGISTRO_ABIERTO = 16

export function assertPuedePausar(role: string) {
  // Picking de Muebles tambien almuerza: su orden y sus PLU se detienen igual.
  if (!puedeUsarMontacargas(role) && !puedePickear(role)) {
    throw createError({ statusCode: 403, statusMessage: 'Sin acceso a pausas operativas' })
  }
}

export async function iniciarPausa(usuarioId: string, motivo: 'ALIMENTACION' | 'CAMBIO_BATERIAS') {
  const activa = await prisma.pausaOperativa.findUnique({ where: { activaUsuarioId: usuarioId } })
  if (activa) throw createError({ statusCode: 409, statusMessage: 'Ya tienes una pausa activa; finalízala antes de iniciar otra' })

  // Solo trabajo de este turno. Un registro abierto hace mas de 16 h es uno
  // olvidado: pausarlo cerraba un tramo de dias que Indicadores contaba como
  // trabajo (PLU 4745 de FABIAN MANRIQUE, abierto desde el 10-09).
  const inicio = new Date()
  const reciente = { gte: new Date(inicio.getTime() - HORAS_MAX_REGISTRO_ABIERTO * 3600 * 1000) }
  const [movimientos, tareas, pendientes, recepciones, ordenesMuebles, lineasMuebles] = await Promise.all([
    prisma.movimientoMontacargas.findMany({ where: { responsableId: usuarioId, estado: 'EN_CURSO', deletedAt: null, horaInicio: reciente }, select: { id: true } }),
    prisma.tareaResurtido.findMany({ where: { estado: 'EN_CURSO', horaInicio: reciente, montaje: { deletedAt: null }, OR: [{ responsableId: usuarioId }, { responsableId: null, montaje: { operarioId: usuarioId } }] }, select: { id: true } }),
    prisma.pendienteGourmet.findMany({ where: { operarioId: usuarioId, estado: 'EN_CURSO', deletedAt: null, tareaResurtidoId: null, horaInicio: reciente }, select: { id: true } }),
    prisma.recepcionContenedor.findMany({ where: { creadoPorId: usuarioId, estado: 'EN_CURSO', deletedAt: null, horaInicio: reciente }, select: { id: true } }),
    prisma.ordenMuebles.findMany({ where: { estado: 'EN_PICKING', deletedAt: null, horaInicio: reciente, participantes: { some: { usuarioId } } }, select: { id: true } }),
    prisma.lineaMuebles.findMany({ where: { operarioId: usuarioId, estado: 'EN_PICKING', horaInicio: reciente, orden: { deletedAt: null } }, select: { id: true } }),
  ])
  const ids = (rows: { id: string }[]) => rows.map(r => r.id)
  const pausa = await prisma.pausaOperativa.create({ data: {
    usuarioId, activaUsuarioId: usuarioId, motivo, inicio,
    movimientos: ids(movimientos), tareas: ids(tareas), pendientes: ids(pendientes), recepciones: ids(recepciones),
    ordenesMuebles: ids(ordenesMuebles), lineasMuebles: ids(lineasMuebles),
  } })
  const data = { pausaId: pausa.id, pausaInicio: inicio }
  for (const r of movimientos) await cerrarTramoAbierto(prisma, r.id, inicio)
  for (const r of tareas) await cerrarTramoTarea(prisma, r.id, inicio)
  for (const r of pendientes) await cerrarTramoPendiente(prisma, r.id, inicio)
  await prisma.movimientoMontacargas.updateMany({ where: { id: { in: pausa.movimientos } }, data })
  await prisma.tareaResurtido.updateMany({ where: { id: { in: pausa.tareas } }, data })
  await prisma.pendienteGourmet.updateMany({ where: { id: { in: pausa.pendientes } }, data })
  await prisma.recepcionContenedor.updateMany({ where: { id: { in: pausa.recepciones } }, data })
  await prisma.ordenMuebles.updateMany({ where: { id: { in: pausa.ordenesMuebles } }, data })
  await prisma.lineaMuebles.updateMany({ where: { id: { in: pausa.lineasMuebles } }, data })
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
  // Muebles no lleva tramos por persona: el PLU y la orden siguen siendo de
  // quien los abrio, asi que basta con acumular lo pausado.
  await prisma.ordenMuebles.updateMany({ where: { pausaId: pausa.id }, data })
  await prisma.lineaMuebles.updateMany({ where: { pausaId: pausa.id }, data })
  await prisma.activityLog.create({ data: { userId: usuarioId, action: 'UPDATE', module: 'pausas-operativas', recordId: pausa.id, details: `Fin de pausa: ${pausa.motivo}; ${Math.round(segundos)} segundos` } })
}
