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
      cajas: { select: { codigoCaja: true } },
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
  // Igual que en la creación del pedido: MUEBLES permite repetir el número
  // de caja (varias partes del mismo mueble); GOURMET no.
  if (pedido.tipoPedido === 'GOURMET') {
    const yaExiste = pedido.cajas.some((c) => c.codigoCaja?.trim().toLowerCase() === codigoTrim.toLowerCase())
    if (yaExiste) throw createError({ statusCode: 409, statusMessage: `Ya existe una caja con el código "${codigoTrim}" en este pedido.`, data: { code: 'CODIGO_DUPLICADO' } })
  }

  const cajasEnEstiba = await prisma.gourmetPedidoCaja.count({ where: { estibaId } })

  const pedidoActualizado = await prisma.$transaction(async (tx) => {
    await tx.gourmetPedidoCaja.create({
      data: { pedidoId: id, estibaId, codigoCaja: codigoTrim, numeroSecuencia: cajasEnEstiba + 1, generadaPorEscaneo: false },
    })
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
