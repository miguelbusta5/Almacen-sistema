import { createError, defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { actorInventario, filasInventario } from '../../utils/inventarioCiclico'
import { esperadosDeUbicacion, normalizarUbicacionInventario, resumenTareas } from '../../utils/inventarioCiclicoCalc'
import { sanearPaginacion } from '../../utils/paginacion'

/**
 * GET /api/inventarios/ciclos            - los ciclicos que puedo ver
 * GET /api/inventarios/ciclos?id=        - uno, con su lista de ubicaciones
 * GET /api/inventarios/ciclos?id=&detalle=1 - ademas el teorico (solo gestor)
 *
 * La lista de ubicaciones va SIN el teorico, sin los registros y sin los PLU
 * esperados: con 2.106 ubicaciones eso eran 0,8 MB y ~3 s en cada refresco, y
 * en la Zebra se sentia. Lo de cada ubicacion se pide aparte (tarea.get.ts).
 *
 * Conteo a ciegas: `filas`, `teorico` y `avisos` solo viajan con detalle=1, que
 * es cosa del gestor; nunca al navegador de quien cuenta.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  const permisos = await actorInventario(actor)
  const q = getQuery(event)
  const id = typeof q.id === 'string' ? q.id : null

  if (!id) {
    return {
      permisos,
      ciclos: await prisma.inventarioCiclico.findMany({
        where: permisos.gestionar ? {} : { tareas: { some: { usuarioId: actor.id } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true, nombre: true, estado: true, createdAt: true,
          cronograma: { select: { nombre: true } },
          _count: { select: { tareas: true, casos: true } },
        },
      }),
    }
  }

  const detalle = String(q.detalle ?? '') === '1' && permisos.gestionar
  const { page, pageSize } = sanearPaginacion(q.page, q.pageSize, 50, 200)
  const buscada = normalizarUbicacionInventario(q.q)
  const estado = typeof q.estado === 'string' && q.estado ? q.estado : null

  const ciclo = await prisma.inventarioCiclico.findUnique({
    where: { id },
    select: {
      id: true, nombre: true, estado: true,
      ...(detalle ? { filas: true, teorico: true, avisos: true } : {}),
      casos: permisos.gestionar
        ? { include: { tareas: { include: { registros: true } } } }
        : false,
    },
  })
  if (!ciclo) throw createError({ statusCode: 404, statusMessage: 'Cíclico no encontrado' })

  // Quien no gestiona solo ve lo suyo; y si no tiene nada aqui, el ciclico no
  // es suyo (mismo criterio que antes, ahora resuelto en la consulta).
  const mias = permisos.gestionar ? {} : { usuarioId: actor.id }
  const where = {
    cicloId: id,
    ...mias,
    ...(buscada ? { ubicacion: { contains: buscada } } : {}),
    ...(estado ? { estado } : {}),
  }

  const [tareas, total, todas, personasIds] = await Promise.all([
    prisma.inventarioTarea.findMany({
      where,
      orderBy: { ubicacion: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, ubicacion: true, tipo: true, estado: true, usuarioId: true, casoId: true,
        inicio: true, fin: true, pausaInicio: true, pausaMotivo: true, pausaSegundos: true, revision: true,
        _count: { select: { registros: true } },
      },
    }),
    prisma.inventarioTarea.count({ where }),
    // Para el resumen y para el escaneo: livianas, sin registros ni esperados.
    prisma.inventarioTarea.findMany({
      where: { cicloId: id, ...mias },
      select: { id: true, ubicacion: true, tipo: true, estado: true, usuarioId: true },
      orderBy: { ubicacion: 'asc' },
    }),
    prisma.inventarioTarea.findMany({ where: { cicloId: id }, select: { usuarioId: true }, distinct: ['usuarioId'] }),
  ])
  if (!permisos.gestionar && !todas.length) throw createError({ statusCode: 404, statusMessage: 'Cíclico no encontrado' })

  const personas = await prisma.user.findMany({
    where: { id: { in: personasIds.map(p => p.usuarioId).filter((x): x is string => !!x) } },
    select: { id: true, name: true },
  })

  return {
    permisos,
    id: ciclo.id,
    nombre: ciclo.nombre,
    estado: ciclo.estado,
    tareas,
    ubicaciones: todas,
    resumen: resumenTareas(todas),
    paginacion: { page, pageSize, total },
    personas,
    casos: permisos.gestionar ? ciclo.casos : [],
    ...(detalle
      ? {
          filas: filasInventario(ciclo.filas!),
          teorico: ciclo.teorico,
          avisos: ciclo.avisos,
          // Para asignar ubicaciones hace falta saber cuales traen varios PLU.
          esperadosPorUbicacion: Object.fromEntries(
            todas.map(t => [t.ubicacion, esperadosDeUbicacion(filasInventario(ciclo.filas!), t.ubicacion)]),
          ),
        }
      : {}),
  }
})
