import { defineEventHandler, readBody, getRouterParam, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../../utils/prisma'
import { requireRole } from '../../../../utils/auth'
import { mapPedidoGourmetDetalle } from '../../../../utils/mapRow'
import { validarCodigoCaja } from '../../../../utils/gourmetCaja'

// Solo estos dos roles pueden corregir la lista de cajas de un pedido ya
// creado (ver conversación: corregir una caja que no corresponde al pedido).
const ROLES_PERMITIDOS = ['ADMIN', 'OPERACIONES_GOURMET']
// Mismos estados en los que ya se puede editar la cabecera del pedido —
// una vez enviado a transporte, la lista de cajas queda fija.
const ESTADOS_EDITABLES = ['BORRADOR', 'UBICACION_ASIGNADA', 'CON_NOVEDAD']

const bodySchema = z.object({
  estibaId: z.string().min(1),
  codigoCaja: z.string().min(1).max(150),
})

// POST /api/cargue-gourmet/[id]/cajas — agrega una caja manualmente (sin
// escanear) a una estiba del pedido, ej. para reemplazar una caja que se
// eliminó por estar mal digitada.
export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, ROLES_PERMITIDOS)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  const { estibaId, codigoCaja } = parsed.data

  const pedido = await prisma.gourmetPedido.findUnique({
    where: { id },
    select: {
      estado: true, tipoPedido: true, tipoOrden: true, orden: true,
      estibas: { select: { id: true } },
    },
  })
  if (!pedido) throw createError({ statusCode: 404, statusMessage: 'No encontrado' })

  if (!ESTADOS_EDITABLES.includes(pedido.estado)) {
    throw createError({ statusCode: 409, statusMessage: `No se puede editar la lista de cajas en estado ${pedido.estado}`, data: { code: 'ESTADO_NO_EDITABLE' } })
  }
  if (!pedido.estibas.some((e) => e.id === estibaId)) {
    throw createError({ statusCode: 400, statusMessage: 'La estiba indicada no pertenece a este pedido' })
  }

  const r = validarCodigoCaja(codigoCaja, { permitirLetras: pedido.tipoPedido === 'MUEBLES' })
  if (!r.ok) throw createError({ statusCode: 400, statusMessage: r.error })

  const codigoTrim = codigoCaja.trim()

  // El chequeo de duplicado (solo aplica a GOURMET) y la inserción van
  // juntos dentro de la misma transacción, con el pedido bloqueado (FOR
  // UPDATE) — así dos solicitudes casi simultáneas (doble clic, reintento
  // de red) se serializan: la segunda sí ve la caja que la primera acaba
  // de insertar. Antes esta lectura ocurría fuera de la transacción y
  // ambas requests podían leer "no existe todavía" a la vez, dejando dos
  // cajas idénticas en un pedido GOURMET (donde nunca debería haber
  // códigos duplicados) — eso fue justo lo que disparó el bug de "Caja
  // ajena" reportado en TSDM100536.
  const pedidoActualizado = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM gourmet_pedidos WHERE id = ${id} FOR UPDATE`

    if (pedido.tipoPedido === 'GOURMET') {
      const cajasActuales = await tx.gourmetPedidoCaja.findMany({ where: { pedidoId: id }, select: { codigoCaja: true } })
      const yaExiste = cajasActuales.some((c) => c.codigoCaja?.trim().toLowerCase() === codigoTrim.toLowerCase())
      if (yaExiste) throw createError({ statusCode: 409, statusMessage: `Ya existe una caja con el código "${codigoTrim}" en este pedido.`, data: { code: 'CODIGO_DUPLICADO' } })
    }

    const cajasEnEstiba = await tx.gourmetPedidoCaja.count({ where: { estibaId } })
    await tx.gourmetPedidoCaja.create({
      data: { pedidoId: id, estibaId, codigoCaja: codigoTrim, numeroSecuencia: cajasEnEstiba + 1, generadaPorEscaneo: false },
    })

    // cajasEsperadas se recalcula al conteo real tras agregar una caja —
    // si no, el encabezado queda desincronizado del número real de cajas
    // registradas y "Finalizar" rechaza por conteo distinto sin ninguna
    // explicación clara para el operario.
    const totalCajas = await tx.gourmetPedidoCaja.count({ where: { pedidoId: id } })
    await tx.gourmetPedido.update({ where: { id }, data: { cajasEsperadas: totalCajas } })

    return tx.gourmetPedido.findUniqueOrThrow({
      where: { id },
      include: {
        creadoPor: { select: { name: true } },
        estibas: { orderBy: { secuencia: 'asc' } },
        cajas: { orderBy: [{ numeroSecuencia: 'asc' }, { createdAt: 'asc' }] },
      },
    })
  })

  await prisma.activityLog.create({
    data: { userId: actor.id, action: 'UPDATE', module: 'cargue-gourmet', recordId: id, details: `Caja agregada manualmente — código ${codigoTrim} (${pedido.tipoOrden} ${pedido.orden})` },
  }).catch(() => {})

  return { success: true, data: mapPedidoGourmetDetalle(pedidoActualizado) }
})
