import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import { auditar, esParticipante, ordenPorId, ORDEN_INCLUDE, requirePicking } from '../../../utils/muebles'
import { esGestionMuebles, puedeCerrarOrden, validarPasoAInspeccion } from '../../../utils/mueblesCalc'
import { mapOrdenMuebles } from '../../../utils/mapRow'

/**
 * POST /api/picking-muebles/:id/inspeccion - CIERRA el reloj de picking y ABRE
 * el de inspeccion, en la misma transaccion.
 *
 * Encadenados a proposito: si fueran dos llamadas quedaria un hueco de tiempo
 * sin dueno entre que el operario suelta la orden y el area la recibe.
 *
 * El operario descarga el equipo al hacer esto, y como la capacidad se calcula
 * sobre las lineas de la orden abierta, vuelve a cero sola.
 */
export default defineEventHandler(async (event) => {
  const actor = await requirePicking(event)
  const id = getRouterParam(event, 'id')!

  const orden = await ordenPorId(id)
  if (orden.estado !== 'EN_PICKING') {
    throw createError({ statusCode: 409, statusMessage: 'La orden ya paso a inspeccion' })
  }
  // La pasa el ULTIMO que se unio: si hubo reasignacion, es el que termina el
  // trabajo. Gestion puede siempre, para que la orden no se quede abierta toda
  // la noche si esa persona sale de turno.
  if (!puedeCerrarOrden(orden.participantes, actor.id, actor.role)) {
    const cierra = orden.participantes[orden.participantes.length - 1]
    throw createError({
      statusCode: 403,
      statusMessage: `La pasa a inspeccion ${cierra?.usuario.name ?? 'el operario que se unio'}, que es quien termina`,
    })
  }

  const err = validarPasoAInspeccion(orden.lineas)
  if (err) {
    // Si el PLU abierto es del companero, decirlo: "termina el PLU en curso"
    // mandaria a este operario a buscar uno suyo que no existe.
    const ajeno = orden.lineas.find((l) => l.estado === 'EN_PICKING' && l.operarioId !== actor.id)
    throw createError({
      statusCode: 409,
      statusMessage: ajeno
        ? `${ajeno.operario?.name ?? 'El otro operario'} tiene el PLU ${ajeno.plu} en curso`
        : err,
    })
  }

  const now = new Date()
  const actualizada = await prisma.ordenMuebles.update({
    where: { id: orden.id },
    data: { estado: 'EN_INSPECCION', horaPasoInspeccion: now, actualizadoPorId: actor.id },
    include: ORDEN_INCLUDE,
  })

  // El cierre de un supervisor se audita distinto: es la excepcion, y mezclarlo
  // con el cierre normal escondia justo el caso que interesa revisar.
  const porGestion = esGestionMuebles(actor.role) && !orden.participantes.some((p) => p.usuarioId === actor.id)
  const quienes = orden.participantes.map((p) => p.usuario.name).join(' + ')
  await auditar(
    actor.id, 'UPDATE', 'picking-muebles', orden.id,
    `Orden ${orden.codigo} pasada a inspeccion con ${orden.lineas.length} PLU (${quienes})`
      + (porGestion ? ' — cerrada por supervision' : ''),
  )

  return { success: true, data: mapOrdenMuebles(actualizada) }
})
