import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../../utils/prisma'
import { auditarCargue, buscarOrdenCargue, camionPorId, mapCargue, requireCargue } from '../../../../utils/cargueCamion'
import { normalizarTextoCargue, validarCodigoCargue } from '../../../../utils/cargueCamionCalc'

const schema = z.object({
  codigo: z.string().max(100),
  /** Solo si la orden no existe en Cargue Gourmet ni en Muebles (manual). */
  tienda: z.string().max(255).nullable().optional(),
  cliente: z.string().max(160).nullable().optional(),
  ciudad: z.string().max(80).nullable().optional(),
})

/**
 * POST /api/cargue-camiones/:id/ordenes - AGREGA una orden al camion e INICIA
 * su cargue (arranca su reloj). Una orden a la vez por camion: la anterior se
 * finaliza primero. Trae de Cargue Gourmet y de Muebles la tienda, el cliente,
 * la ciudad y los bultos declarados; si no existe en ninguno se agrega a mano.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireCargue(event)
  const camion = await camionPorId(getRouterParam(event, 'id')!)
  if (camion.estado !== 'EN_CURSO') throw createError({ statusCode: 409, statusMessage: 'Este camion ya se finalizo' })
  const enCurso = camion.ordenes.find((o) => !o.horaFin)
  if (enCurso) throw createError({ statusCode: 409, statusMessage: `Finaliza primero el cargue de ${enCurso.codigo}` })

  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  const d = parsed.data
  const error = validarCodigoCargue(d.codigo)
  if (error) throw createError({ statusCode: 400, statusMessage: error })

  const o = await buscarOrdenCargue(d.codigo)
  if (o.yaCargadaEn) {
    throw createError({
      statusCode: 409,
      statusMessage: o.yaCargadaEn.cargueId === camion.id
        ? `${o.codigo} ya esta en este camion`
        : `${o.codigo} ya se cargo en otro camion${o.yaCargadaEn.placa ? ` (${o.yaCargadaEn.placa})` : ''} el ${o.yaCargadaEn.fecha}`,
    })
  }
  if (o.bloqueo) throw createError({ statusCode: 409, statusMessage: o.bloqueo })

  const manual = o.origen === 'MANUAL'
  const ciudad = manual ? normalizarTextoCargue(d.ciudad) : o.ciudad
  if (manual && !ciudad) {
    throw createError({ statusCode: 400, statusMessage: `${o.codigo} no esta en Cargue Gourmet ni en Muebles: escribe al menos la ciudad` })
  }

  await prisma.cargueCamionOrden.create({
    data: {
      cargueId: camion.id,
      codigo: o.codigo,
      tipoOrden: o.tipoOrden,
      origen: o.origen,
      gourmetPedidoId: o.gourmetPedidoId,
      ordenMueblesId: o.ordenMueblesId,
      tienda: manual ? (d.tienda?.trim() || null) : o.tienda,
      cliente: manual ? (d.cliente?.trim() || null) : o.cliente,
      ciudad,
      bultosGourmet: o.bultosGourmet,
      bultosMuebles: o.bultosMuebles,
      bultosDeclarados: o.bultosDeclarados,
      horaInicio: new Date(),
    },
  })

  await auditarCargue(actor.id, 'UPDATE', camion.id, `Orden ${o.codigo} (${o.origen.toLowerCase()}) en cargue`)
  return { success: true, data: mapCargue(await camionPorId(camion.id)) }
})
