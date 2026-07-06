import { defineEventHandler, readBody, getRouterParam, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireRole } from '../../../utils/auth'
import { mapPedidoGourmetDetalle } from '../../../utils/mapRow'
import { derivarTipoOrden, esCodigoTiendaCliente, CODIGO_TIENDA_CLIENTE, NOMBRE_TIENDA_CLIENTE, CIUDAD_TIENDA_CLIENTE } from '../../../utils/gourmetPedido'

const ROLES_EDITAN = ['OPERACIONES_GOURMET', 'ADMIN', 'GERENTE']
// Estados desde los que se puede editar la cabecera (antes/durante corrección,
// nunca una vez el pedido entró en el flujo operativo de Transporte).
const ESTADOS_EDITABLES = ['BORRADOR', 'UBICACION_ASIGNADA', 'CON_NOVEDAD']

const updateSchema = z.object({
  orden: z.string().min(1).max(100).optional(),
  codigoTienda: z.string().min(1).max(50).optional(),
  cajasEsperadas: z.number().int().min(1).optional(),
  estibasEsperadas: z.number().int().min(1).optional(),
  updatedAt: z.string(),
})

// PUT /api/cargue-gourmet/[id]
export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, ROLES_EDITAN)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  const d = parsed.data

  const current = await prisma.gourmetPedido.findUnique({
    where: { id },
    select: { estado: true, updatedAt: true, codigoTienda: true, orden: true },
  })
  if (!current) throw createError({ statusCode: 404, statusMessage: 'No encontrado' })

  // ADMIN/GERENTE pueden corregir datos básicos sin importar el estado del
  // pedido; OPERACIONES_GOURMET conserva la restricción a estados tempranos.
  const esGestor = actor.role === 'ADMIN' || actor.role === 'GERENTE'
  if (!esGestor && !ESTADOS_EDITABLES.includes(current.estado)) {
    throw createError({ statusCode: 409, statusMessage: `No se puede editar un pedido en estado ${current.estado}`, data: { code: 'ESTADO_NO_EDITABLE' } })
  }

  if (new Date(d.updatedAt).getTime() !== current.updatedAt.getTime()) {
    throw createError({ statusCode: 409, statusMessage: 'Conflicto: el pedido fue modificado por otro usuario', data: { code: 'CONFLICT' } })
  }

  const data: Record<string, unknown> = {}
  if (d.orden !== undefined) {
    const ordenTrim = d.orden.trim()
    if (ordenTrim.toLowerCase() !== current.orden.trim().toLowerCase()) {
      const duplicado = await prisma.gourmetPedido.findFirst({
        where: { id: { not: id }, orden: { equals: ordenTrim, mode: 'insensitive' }, estado: { not: 'CANCELADO' } },
        select: { id: true, estado: true },
      })
      if (duplicado) {
        throw createError({
          statusCode: 409,
          statusMessage: `Ya existe otro pedido con la orden "${ordenTrim}" (estado: ${duplicado.estado}).`,
          data: { code: 'ORDEN_DUPLICADA', id: duplicado.id, estado: duplicado.estado },
        })
      }
    }
    data.orden = d.orden
    data.tipoOrden = derivarTipoOrden(d.orden)
  }
  if (d.cajasEsperadas !== undefined) data.cajasEsperadas = d.cajasEsperadas
  if (d.estibasEsperadas !== undefined) data.estibasEsperadas = d.estibasEsperadas

  if (d.codigoTienda !== undefined && d.codigoTienda !== current.codigoTienda) {
    if (esCodigoTiendaCliente(d.codigoTienda)) {
      data.codigoTienda = CODIGO_TIENDA_CLIENTE
      data.nombreTienda = NOMBRE_TIENDA_CLIENTE
      data.ciudadDestino = CIUDAD_TIENDA_CLIENTE
    } else {
      const tienda = await prisma.maestroTiendaGourmet.findUnique({ where: { codigo: d.codigoTienda } })
      if (!tienda) throw createError({ statusCode: 400, statusMessage: 'El código de tienda no existe en el maestro' })
      if (!tienda.activo) throw createError({ statusCode: 400, statusMessage: 'La tienda está inactiva en el maestro' })
      data.codigoTienda = tienda.codigo
      data.nombreTienda = tienda.tienda
      data.ciudadDestino = tienda.ciudad
    }
  }

  const pedido = await prisma.gourmetPedido.update({
    where: { id },
    data,
    include: { creadoPor: { select: { name: true } } },
  })

  await prisma.activityLog.create({
    data: { userId: actor.id, action: 'UPDATE', module: 'cargue-gourmet', recordId: pedido.id, details: `Edición de datos básicos — ${pedido.tipoOrden} ${pedido.orden}` },
  }).catch(() => {})

  return { success: true, data: mapPedidoGourmetDetalle(pedido) }
})
