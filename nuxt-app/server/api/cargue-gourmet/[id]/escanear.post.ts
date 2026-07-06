import { defineEventHandler, readBody, getRouterParam, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireRole } from '../../../utils/auth'
import { clasificarEscaneoGourmet, type ModoCodigoGourmet } from '../../../utils/gourmetEscaneo'

const ROLES_PERMITIDOS = ['TRANSPORTE', 'SUPERVISOR_TRANSPORTE', 'OPERACIONES_GOURMET', 'ADMIN', 'GERENTE']

const bodySchema = z.object({ codigo: z.string() })

// QR_SOLO_ORDEN es un caso legacy: alguien registró el mismo código repetido
// en más de una caja como placeholder del código de orden (no códigos reales
// por caja) — solo se puede detectar comparando ≥2 registros. Con 1 sola caja
// registrada el Set también da tamaño 1, pero ahí SÍ es un código real de
// caja, así que debe tratarse como QR_UNICO_CAJA (mismo fix que Next.js).
function determinarModoCodigo(codigosCaja: string[]): ModoCodigoGourmet {
  if (codigosCaja.length === 0) return 'SIN_CODIGOS_PREVIOS'
  if (codigosCaja.length === 1) return 'QR_UNICO_CAJA'
  return new Set(codigosCaja).size > 1 ? 'QR_UNICO_CAJA' : 'QR_SOLO_ORDEN'
}

// POST /api/cargue-gourmet/[id]/escanear
export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, ROLES_PERMITIDOS)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'El campo codigo es obligatorio' })
  const { codigo } = parsed.data

  const pedido = await prisma.gourmetPedido.findUnique({
    where: { id },
    select: { id: true, orden: true, estado: true, cajas: { select: { codigoCaja: true } } },
  })
  if (!pedido) throw createError({ statusCode: 404, statusMessage: 'No encontrado' })

  if (pedido.estado !== 'EN_CARGUE') {
    throw createError({ statusCode: 409, statusMessage: `No se puede escanear: el pedido está en estado ${pedido.estado}`, data: { code: 'ESTADO_INVALIDO' } })
  }

  const cargue = await prisma.gourmetCargue.findFirst({
    where: { pedidoId: id, estado: 'EN_CARGUE' },
    include: { escaneos: { where: { resultado: 'VALIDO' }, select: { codigoEscaneado: true } } },
  })
  if (!cargue) throw createError({ statusCode: 409, statusMessage: 'No hay un cargue activo para este pedido' })

  const codigosCaja = pedido.cajas.map((c) => c.codigoCaja).filter((c): c is string => !!c)
  const modoCodigo = determinarModoCodigo(codigosCaja)

  const clasificacion = clasificarEscaneoGourmet({
    codigo,
    ordenPedido: pedido.orden,
    cajasEsperadas: cargue.cantidadEsperada,
    codigosCajaEsperados: codigosCaja,
    escaneosValidosPrevios: cargue.escaneos.map((e) => e.codigoEscaneado),
    modoCodigo,
  })

  const tipoNovedad = clasificacion.tipoNovedadSugerido

  const { escaneo, novedad, cantidadEscaneada } = await prisma.$transaction(async (tx) => {
    const nuevoEscaneo = await tx.gourmetCargueEscaneo.create({
      data: { cargueId: cargue.id, pedidoId: pedido.id, codigoEscaneado: codigo, resultado: clasificacion.resultado, escaneadoPorId: actor.id, observacion: clasificacion.mensaje },
    })

    let nuevaCantidad = cargue.cantidadEscaneada
    if (clasificacion.incrementaContador) {
      const cargueActualizado = await tx.gourmetCargue.update({
        where: { id: cargue.id }, data: { cantidadEscaneada: { increment: 1 } }, select: { cantidadEscaneada: true },
      })
      nuevaCantidad = cargueActualizado.cantidadEscaneada
    }

    let nuevaNovedad = null
    if (clasificacion.debeCrearNovedad && tipoNovedad) {
      nuevaNovedad = await tx.gourmetCargueNovedad.create({
        data: { cargueId: cargue.id, pedidoId: pedido.id, tipo: tipoNovedad, descripcion: clasificacion.mensaje, estado: 'ABIERTA', registradaPorId: actor.id },
      })
    }

    return { escaneo: nuevoEscaneo, novedad: nuevaNovedad, cantidadEscaneada: nuevaCantidad }
  })

  return {
    success: true,
    resultado: clasificacion.resultado,
    progreso: { escaneados: cantidadEscaneada, esperados: cargue.cantidadEsperada },
    novedadCreada: !!novedad,
    data: {
      escaneo: { id: escaneo.id, codigoEscaneado: escaneo.codigoEscaneado, resultado: escaneo.resultado, createdAt: escaneo.createdAt.toISOString() },
      ...(novedad ? { novedad: { id: novedad.id, tipo: novedad.tipo, estado: novedad.estado, descripcion: novedad.descripcion } } : {}),
    },
  }
})
