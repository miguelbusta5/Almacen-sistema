import { createError, defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { actorInventario, filasInventario } from '../../utils/inventarioCiclico'
import { buscarTareaPorUbicacion, esperadosDeUbicacion, normalizarUbicacionInventario } from '../../utils/inventarioCiclicoCalc'

/**
 * GET /api/inventarios/tarea?cicloId=&tareaId=  (o &ubicacion=)
 *
 * UNA ubicacion con lo que hace falta para contarla. Existe aparte de
 * ciclos.get.ts porque ese, con 2.106 ubicaciones, devolvia 0,8 MB y tardaba
 * ~3 s: el operario solo necesita la que tiene delante.
 *
 * Resolver por `ubicacion` es lo que permite escanear y saltar directo, aunque
 * esa ubicacion no este en la pagina que la pantalla tiene cargada.
 *
 * Conteo a ciegas: aqui viajan los PLU esperados, nunca el teorico.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  const permisos = await actorInventario(actor)
  const q = getQuery(event)
  const cicloId = typeof q.cicloId === 'string' ? q.cicloId : ''
  const tareaId = typeof q.tareaId === 'string' ? q.tareaId : ''
  const ubicacion = normalizarUbicacionInventario(q.ubicacion)
  if (!cicloId || (!tareaId && !ubicacion)) throw createError({ statusCode: 400, statusMessage: 'Indica la tarea o la ubicación' })

  const ciclo = await prisma.inventarioCiclico.findUnique({
    where: { id: cicloId },
    select: {
      id: true, estado: true, filas: true,
      tareas: { select: { id: true, ubicacion: true, tipo: true, estado: true, usuarioId: true, casoId: true } },
      casos: { select: { id: true, plu: true } },
    },
  })
  if (!ciclo) throw createError({ statusCode: 404, statusMessage: 'Cíclico no encontrado' })

  // Por ubicacion se resuelve con la misma regla que usa la pantalla; por id,
  // solo se comprueba que exista y sea suya (o que quien pregunta gestione).
  const elegida = tareaId
    ? ciclo.tareas.find(t => t.id === tareaId)
    : (() => {
        const r = buscarTareaPorUbicacion(ciclo.tareas, ubicacion, actor.id)
        if ('tarea' in r) return r.tarea
        const mensajes = {
          NO_EXISTE: 'Esa ubicación no está en este cíclico',
          AJENA: 'Esa ubicación es de otro operario',
          COMPLETADA: 'Ya terminaste esa ubicación',
        } as const
        throw createError({ statusCode: 404, statusMessage: mensajes[r.motivo] })
      })()
  if (!elegida) throw createError({ statusCode: 404, statusMessage: 'Tarea no encontrada' })
  if (!permisos.gestionar && elegida.usuarioId !== actor.id) {
    throw createError({ statusCode: 403, statusMessage: 'Esa tarea no está asignada a tu usuario' })
  }

  const [tarea, filas] = await Promise.all([
    prisma.inventarioTarea.findUniqueOrThrow({ where: { id: elegida.id }, include: { registros: true } }),
    Promise.resolve(filasInventario(ciclo.filas)),
  ])

  const esperados = tarea.tipo === 'INICIAL'
    ? esperadosDeUbicacion(filas, tarea.ubicacion)
    : [{
        plu: ciclo.casos.find(c => c.id === tarea.casoId)?.plu ?? '',
        descripcion: filas.find(f => f.plu === ciclo.casos.find(c => c.id === tarea.casoId)?.plu)?.descripcion
          ?? 'Producto reportado como novedad',
      }]

  return { estadoCiclo: ciclo.estado, tarea: { ...tarea, esperados } }
})
