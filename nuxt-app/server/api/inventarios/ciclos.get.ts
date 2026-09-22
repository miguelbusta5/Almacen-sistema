import { createError, defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { actorInventario, filasInventario } from '../../utils/inventarioCiclico'

export default defineEventHandler(async event => {
  const actor = await requireAuth(event), permisos = await actorInventario(actor)
  const q = getQuery(event), id = typeof q.id === 'string' ? q.id : null
  if (!id) return { permisos, ciclos: await prisma.inventarioCiclico.findMany({
    where: permisos.gestionar ? {} : { tareas: { some: { usuarioId: actor.id } } },
    orderBy: { createdAt: 'desc' }, take: 100,
    select: { id: true, nombre: true, estado: true, createdAt: true, cronograma: { select: { nombre: true } }, _count: { select: { tareas: true, casos: true } } },
  }) }
  const c = await prisma.inventarioCiclico.findUnique({ where: { id }, include: { tareas: { include: { registros: true }, orderBy: { ubicacion: 'asc' } }, casos: { include: { tareas: { include: { registros: true } } } } } })
  if (!c || (!permisos.gestionar && !c.tareas.some(t => t.usuarioId === actor.id))) throw createError({ statusCode: 404, statusMessage: 'Cíclico no encontrado' })
  const filas = filasInventario(c.filas)
  // Blind count: theoretical quantities never travel to the counter's browser.
  const tareas = c.tareas.filter(t => permisos.gestionar || t.usuarioId === actor.id).map(t => ({ ...t,
    esperados: t.tipo === 'INICIAL'
      ? filas.filter(f => f.concepto === 'RETIRO' && f.ubicacion === t.ubicacion).map(f => ({ plu: f.plu, descripcion: f.descripcion }))
      : [{ plu: c.casos.find(x => x.id === t.casoId)!.plu, descripcion: filas.find(f => f.plu === c.casos.find(x => x.id === t.casoId)?.plu)?.descripcion ?? 'Producto reportado como novedad' }],
  }))
  const ids = [...new Set(c.tareas.map(t => t.usuarioId).filter((x): x is string => !!x))]
  const personas = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
  return { permisos, id: c.id, nombre: c.nombre, estado: c.estado, tareas, personas,
    casos: permisos.gestionar ? c.casos : [],
    ...(permisos.gestionar ? { filas, teorico: c.teorico, avisos: c.avisos } : {}),
  }
})
