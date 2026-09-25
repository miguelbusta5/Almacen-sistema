import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../../../utils/prisma'
import { auditarCargue, camionPorId, mapCargue, requireCargue } from '../../../../../utils/cargueCamion'
import { ESTADOS_GOURMET_POR_COMPLETAR, validarFinOrden } from '../../../../../utils/cargueCamionCalc'

const schema = z.object({
  bultos: z.number(),
  nota: z.string().max(300).nullable().optional(),
})

/**
 * POST /api/cargue-camiones/:id/ordenes/:ordenId/finalizar - FINALIZA el
 * cargue de la orden (para su reloj) con los bultos contados. El camion sigue
 * abierto para mas ordenes.
 *
 * Si los bultos no cuadran con lo declarado, la nota es obligatoria (novedad).
 * Al finalizar se sella lo de muebles (m3, kg y valor OVDM a precio de venta)
 * y se actualiza el origen: la orden de muebles pasa a «Entregada a
 * transporte» y el pedido de Cargue Gourmet listo (ubicacion asignada o
 * enviado) a «Cargue completo (manual)» con los bultos contados.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireCargue(event)
  const camion = await camionPorId(getRouterParam(event, 'id')!)
  const orden = camion.ordenes.find((o) => o.id === getRouterParam(event, 'ordenId'))
  if (!orden) throw createError({ statusCode: 404, statusMessage: 'Orden no encontrada en este camion' })
  if (orden.horaFin) throw createError({ statusCode: 409, statusMessage: `${orden.codigo} ya se finalizo` })

  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  const error = validarFinOrden({ declarados: orden.bultosDeclarados, cargados: parsed.data.bultos, nota: parsed.data.nota })
  if (error) throw createError({ statusCode: 400, statusMessage: error })
  const bultos = parsed.data.bultos
  const diferencia = orden.bultosDeclarados != null && bultos !== orden.bultosDeclarados

  // Lo de muebles, sellado: m3 y kg de sus PLU, y el valor si es una OVDM
  // (sin contado ni orden de tienda) a precio de venta del maestro.
  let m3: number | null = null
  let kg: number | null = null
  let valorOvdm: number | null = null
  if (orden.ordenMueblesId) {
    const om = await prisma.ordenMuebles.findUnique({
      where: { id: orden.ordenMueblesId },
      select: { tipoOrden: true, tiendaOrigenCodigo: true, lineas: { select: { plu: true, unidades: true, volumenTotalM3: true, pesoTotalKg: true } } },
    })
    if (om) {
      m3 = om.lineas.reduce((s, l) => s + Number(l.volumenTotalM3 ?? 0), 0)
      kg = om.lineas.reduce((s, l) => s + Number(l.pesoTotalKg ?? 0), 0)
      if (om.tipoOrden === 'OVDM' && !om.tiendaOrigenCodigo) {
        const precios = new Map((await prisma.productoMaestro.findMany({
          where: { plu: { in: om.lineas.map((l) => l.plu) } }, select: { plu: true, precio: true },
        })).map((p) => [p.plu, Number(p.precio ?? 0)]))
        valorOvdm = om.lineas.reduce((s, l) => s + l.unidades * (precios.get(l.plu) ?? 0), 0)
      }
    }
  }

  const now = new Date()
  await prisma.$transaction(async (tx) => {
    await tx.cargueCamionOrden.update({
      where: { id: orden.id },
      data: {
        horaFin: now, bultosCargados: bultos, notaDiferencia: diferencia ? parsed.data.nota!.trim() : (parsed.data.nota?.trim() || null),
        m3, kg, valorOvdm,
      },
    })
    if (orden.ordenMueblesId) {
      await tx.ordenMuebles.updateMany({
        where: { id: orden.ordenMueblesId, estado: 'INSPECCIONADA' },
        data: { estado: 'ENTREGADA_TRANSPORTE', entregadaTransporteAt: now, entregadaPorId: actor.id },
      })
    }
    if (orden.gourmetPedidoId) {
      await tx.gourmetPedido.updateMany({
        where: { id: orden.gourmetPedidoId, estado: { in: [...ESTADOS_GOURMET_POR_COMPLETAR] } },
        data: {
          estado: 'CARGUE_COMPLETO_MANUAL', esCierreManual: true, cantidadContadaManual: bultos,
          motivoCierreManual: `Cargado en camion${camion.placa ? ` ${camion.placa}` : ''} (${camion.transportadora})`,
          cargueIniciadoAt: orden.horaInicio, cargueIniciadoPorId: actor.id,
          cargueCompletadoAt: now, cargueCompletadoPorId: actor.id,
        },
      })
    }
  })

  await auditarCargue(actor.id, 'UPDATE', camion.id,
    `Orden ${orden.codigo} cargada: ${bultos} bultos${orden.bultosDeclarados != null ? ` de ${orden.bultosDeclarados} declarados` : ''}${diferencia ? ` — novedad: ${parsed.data.nota!.trim()}` : ''}`)
  return { success: true, data: mapCargue(await camionPorId(camion.id)) }
})
