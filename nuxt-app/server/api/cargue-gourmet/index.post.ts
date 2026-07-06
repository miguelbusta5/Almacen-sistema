import { defineEventHandler, readBody, createError, setResponseStatus } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { mapPedidoGourmet } from '../../utils/mapRow'
import { derivarTipoOrden, esCodigoTiendaCliente, CODIGO_TIENDA_CLIENTE, NOMBRE_TIENDA_CLIENTE, CIUDAD_TIENDA_CLIENTE } from '../../utils/gourmetPedido'
import { validarCodigoCaja } from '../../utils/gourmetCaja'

const ROLES_CREAN = ['OPERACIONES_GOURMET', 'ADMIN', 'GERENTE']

const estibaInputSchema = z.object({
  secuencia: z.number().int().min(1),
  cajas: z.array(z.string().min(1).max(150)).min(1),
})

const createSchema = z.object({
  orden: z.string().min(1).max(100),
  codigoTienda: z.string().min(1).max(50),
  cajasEsperadas: z.number().int().min(1),
  estibasEsperadas: z.number().int().min(1),
  // Estibas con cajas escaneadas (opcional — si no se manda, el pedido se
  // crea en BORRADOR sin cajas, igual que en la app Next.js).
  estibas: z.array(estibaInputSchema).optional(),
})

// POST /api/cargue-gourmet
export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, ROLES_CREAN)
  const body = await readBody(event)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  const data = parsed.data

  let codigoTienda: string
  let nombreTienda: string
  let ciudadDestino: string

  if (esCodigoTiendaCliente(data.codigoTienda)) {
    codigoTienda = CODIGO_TIENDA_CLIENTE
    nombreTienda = NOMBRE_TIENDA_CLIENTE
    ciudadDestino = CIUDAD_TIENDA_CLIENTE
  } else {
    const tienda = await prisma.maestroTiendaGourmet.findUnique({ where: { codigo: data.codigoTienda } })
    if (!tienda) throw createError({ statusCode: 400, statusMessage: 'El código de tienda no existe en el maestro' })
    if (!tienda.activo) throw createError({ statusCode: 400, statusMessage: 'La tienda está inactiva en el maestro' })
    codigoTienda = tienda.codigo
    nombreTienda = tienda.tienda
    ciudadDestino = tienda.ciudad
  }

  const tipoOrden = derivarTipoOrden(data.orden)
  const ordenTrim = data.orden.trim()

  // Evita duplicar un pedido por error de captura: si ya existe un pedido con
  // la misma orden (case-insensitive) y no está CANCELADO, se bloquea.
  const duplicado = await prisma.gourmetPedido.findFirst({
    where: { orden: { equals: ordenTrim, mode: 'insensitive' }, estado: { not: 'CANCELADO' } },
    select: { id: true, estado: true },
  })
  if (duplicado) {
    throw createError({
      statusCode: 409,
      statusMessage: `Ya existe un pedido con la orden "${ordenTrim}" (estado: ${duplicado.estado}). Si fue un error de captura, edita ese pedido en vez de crear uno nuevo.`,
      data: { code: 'ORDEN_DUPLICADA', id: duplicado.id, estado: duplicado.estado },
    })
  }

  // ── Validación de estibas y cajas escaneadas (solo si se manda) ──────────
  const estibasInput = data.estibas ?? []
  if (estibasInput.length > 0) {
    if (estibasInput.length !== data.estibasEsperadas) {
      throw createError({ statusCode: 400, statusMessage: `Se esperan ${data.estibasEsperadas} estiba(s) pero se enviaron ${estibasInput.length}.` })
    }
    const secs = estibasInput.map((e) => e.secuencia)
    if (new Set(secs).size !== secs.length) {
      throw createError({ statusCode: 400, statusMessage: 'No se permiten estibas con la misma secuencia.' })
    }
    const todosLosCodigos: string[] = []
    for (const estiba of estibasInput) {
      for (const rawCodigo of estiba.cajas) {
        const r = validarCodigoCaja(rawCodigo)
        if (!r.ok) throw createError({ statusCode: 400, statusMessage: r.error })
        todosLosCodigos.push(rawCodigo.trim())
      }
    }
    if (new Set(todosLosCodigos).size !== todosLosCodigos.length) {
      throw createError({ statusCode: 400, statusMessage: 'Hay códigos de caja repetidos entre estibas. Cada caja solo puede escanearse una vez.' })
    }
    if (todosLosCodigos.length !== data.cajasEsperadas) {
      throw createError({ statusCode: 400, statusMessage: `Se escanearon ${todosLosCodigos.length} caja(s) pero el pedido espera ${data.cajasEsperadas}. Completa el escaneo antes de crear el pedido.` })
    }
  }

  const p = await prisma.gourmetPedido.create({
    data: {
      orden: data.orden,
      tipoOrden,
      codigoTienda,
      nombreTienda,
      ciudadDestino,
      cajasEsperadas: data.cajasEsperadas,
      estibasEsperadas: data.estibasEsperadas,
      estado: 'BORRADOR',
      creadoPorId: actor.id,
    },
  })

  if (estibasInput.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const estibaData of estibasInput) {
        const estiba = await tx.gourmetPedidoEstiba.create({
          data: { pedidoId: p.id, secuencia: estibaData.secuencia, ubicacion: null },
        })
        if (estibaData.cajas.length > 0) {
          await tx.gourmetPedidoCaja.createMany({
            data: estibaData.cajas.map((codigo, idx) => ({
              pedidoId: p.id,
              estibaId: estiba.id,
              codigoCaja: codigo.trim(),
              numeroSecuencia: idx + 1,
              generadaPorEscaneo: true,
            })),
          })
        }
      }
    })
  }

  const pedido = await prisma.gourmetPedido.findUniqueOrThrow({
    where: { id: p.id },
    include: { creadoPor: { select: { name: true } }, estibas: { select: { ubicacion: true, secuencia: true } } },
  })

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: 'CREATE',
      module: 'cargue-gourmet',
      recordId: pedido.id,
      details: `${tipoOrden} ${data.orden} — tienda ${nombreTienda}${estibasInput.length > 0 ? ` (${estibasInput.length} estiba(s) escaneadas)` : ''}`,
    },
  }).catch(() => {})

  setResponseStatus(event, 201)
  return { success: true, data: mapPedidoGourmet(pedido) }
})
