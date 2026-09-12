import { defineEventHandler } from 'h3'
import { capacidadDeOrden, equipoDelDia, ordenAbierta, requirePicking } from '../../utils/muebles'
import { mapEquipoMuebles, mapOrdenMuebles } from '../../utils/mapRow'

/**
 * GET /api/picking-muebles/abierta - la orden en curso del operario, su equipo
 * del dia y la capacidad ocupada. Es lo que pinta la pantalla entera.
 */
export default defineEventHandler(async (event) => {
  const actor = await requirePicking(event)
  const [orden, equipo] = await Promise.all([ordenAbierta(actor.id), equipoDelDia(actor.id)])

  return {
    success: true,
    data: {
      orden: orden ? mapOrdenMuebles(orden) : null,
      equipo: equipo ? mapEquipoMuebles(equipo) : null,
      capacidad: capacidadDeOrden(orden),
    },
  }
})
