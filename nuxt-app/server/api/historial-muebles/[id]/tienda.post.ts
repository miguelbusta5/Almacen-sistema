import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { auditar, ordenPorId, ORDEN_INCLUDE } from '../../../utils/muebles'
import { derivarTipoOrden, esGestionMuebles, validarCodigoOrden } from '../../../utils/mueblesCalc'
import { mapOrdenMuebles } from '../../../utils/mapRow'

const schema = z.object({
  /** null = quitar la tienda: la orden vuelve a ser del CEDI. */
  tiendaCodigo: z.string().trim().min(1).max(50).nullable(),
  motivo: z.string().trim().min(5, 'Escribe por qué se cambia (mínimo 5 letras)').max(300),
})

/**
 * POST /api/historial-muebles/:id/tienda - poner, cambiar o quitar la tienda
 * de origen de una orden ya registrada. Supervision del area.
 *
 * Sirve sobre todo para las que se registraron como contado antes de existir
 * "Orden de tienda" (CONTADO-OVDM121831): al ponerles tienda recuperan su
 * codigo de NetSuite (OVDM121831) y su tipo. Una factura de contado sin
 * OVDM/TSDM dentro (un traslado, una factura) no se puede convertir.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  if (!esGestionMuebles(actor.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Solo supervisión cambia la tienda de una orden' })
  }
  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const d = parsed.data
  const orden = await ordenPorId(getRouterParam(event, 'id')!)

  const data: Record<string, unknown> = { actualizadoPorId: actor.id, motivoCorreccion: d.motivo }
  const cambios: string[] = []

  if (d.tiendaCodigo == null) {
    if (!orden.tiendaOrigenCodigo) throw createError({ statusCode: 400, statusMessage: 'La orden no tiene tienda de origen' })
    data.tiendaOrigenCodigo = null
    data.tiendaOrigenNombre = null
    cambios.push(`Tienda: ${orden.tiendaOrigenNombre} -> ninguna`)
  } else {
    const tienda = await prisma.maestroTiendaGourmet.findUnique({ where: { codigo: d.tiendaCodigo } })
    if (!tienda || !tienda.activo) {
      throw createError({ statusCode: 400, statusMessage: 'La tienda no existe o está inactiva en el maestro' })
    }
    if (tienda.codigo === orden.tiendaOrigenCodigo) throw createError({ statusCode: 400, statusMessage: 'Ya tiene esa tienda' })
    data.tiendaOrigenCodigo = tienda.codigo
    data.tiendaOrigenNombre = tienda.tienda
    cambios.push(`Tienda: ${orden.tiendaOrigenNombre ?? 'ninguna'} -> ${tienda.tienda}`)

    // De contado a orden de tienda: recupera su codigo y su tipo de NetSuite.
    if (orden.tipoOrden === 'CONTADO') {
      const codigo = orden.codigo.replace(/^CONTADO-/, '')
      if (validarCodigoOrden(codigo)) {
        throw createError({
          statusCode: 400,
          statusMessage: `${orden.codigo} no tiene una OVDM/TSDM: no se puede pasar a orden de tienda`,
        })
      }
      const repetida = await prisma.ordenMuebles.findFirst({
        where: { codigo, deletedAt: null, id: { not: orden.id } }, select: { id: true },
      })
      if (repetida) throw createError({ statusCode: 409, statusMessage: `La orden ${codigo} ya existe en muebles` })
      data.codigo = codigo
      data.tipoOrden = derivarTipoOrden(codigo)
      cambios.push(`Codigo: ${orden.codigo} -> ${codigo}`, `Tipo: CONTADO -> ${data.tipoOrden}`)
    }
  }

  const actualizada = await prisma.ordenMuebles.update({ where: { id: orden.id }, data, include: ORDEN_INCLUDE })

  // Empieza por "Correccion": el detalle del historial las lista por ese prefijo.
  await auditar(
    actor.id, 'UPDATE', 'picking-muebles', orden.id,
    `Correccion en ${orden.codigo}: ${cambios.join('; ')}. Motivo: ${d.motivo}`,
  )

  return { success: true, data: mapOrdenMuebles(actualizada) }
})
