import { defineEventHandler, readBody, getRouterParam, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireRole } from '../../../utils/auth'
import { assertTransicionGourmet, type EstadoPedidoGourmet } from '../../../utils/gourmetFlow'

const ROLES_PERMITIDOS = ['OPERACIONES_GOURMET', 'ADMIN', 'GERENTE']

const estibaSchema = z.object({
  secuencia: z.number().int().min(1),
  ubicacion: z.string().min(1).max(120),
  observacion: z.string().nullable().optional(),
})

const cajaSchema = z.object({
  codigoCaja: z.string().min(1).max(150).optional(),
  numeroSecuencia: z.number().int().min(1).optional(),
})

const ubicacionSchema = z.object({
  estibas: z.array(estibaSchema).min(1),
  cajas: z.array(cajaSchema).optional(),
  updatedAt: z.string(),
})

function mapPedido(r: any) {
  // Igual que mapPedidoGourmet (listado) — sin este campo, el parche local
  // de la lista tras asignar ubicación nunca actualizaba la columna
  // "Ubicación", que solo se corregía con un refresco completo.
  const ubicaciones = Array.from(
    new Set(
      (r.estibas ?? [])
        .slice()
        .sort((a: any, b: any) => a.secuencia - b.secuencia)
        .map((e: any) => (e.ubicacion ?? '').trim())
        .filter(Boolean)
    )
  ).join(', ')
  return {
    id: r.id,
    orden: r.orden,
    tipoOrden: r.tipoOrden,
    codigoTienda: r.codigoTienda,
    nombreTienda: r.nombreTienda,
    ciudadDestino: r.ciudadDestino,
    cajasEsperadas: r.cajasEsperadas,
    estibasEsperadas: r.estibasEsperadas,
    estado: r.estado,
    updatedAt: r.updatedAt.toISOString(),
    ubicacionAsignadaAt: r.ubicacionAsignadaAt ? r.ubicacionAsignadaAt.toISOString() : null,
    ubicacionAsignadaPorId: r.ubicacionAsignadaPorId ?? null,
    enviadoTransporteAt: r.enviadoTransporteAt ? r.enviadoTransporteAt.toISOString() : null,
    enviadoTransportePorId: r.enviadoTransportePorId ?? null,
    cargueIniciadoAt: r.cargueIniciadoAt ? r.cargueIniciadoAt.toISOString() : null,
    cargueCompletadoAt: r.cargueCompletadoAt ? r.cargueCompletadoAt.toISOString() : null,
    estibas: r.estibas ?? [],
    cajas: r.cajas ?? [],
    ubicaciones,
  }
}

// POST /api/cargue-gourmet/[id]/ubicacion
export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, ROLES_PERMITIDOS)
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const parsed = ubicacionSchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  const d = parsed.data

  const secuencias = d.estibas.map((e) => e.secuencia)
  if (new Set(secuencias).size !== secuencias.length) {
    throw createError({ statusCode: 400, statusMessage: 'No se permiten estibas con la misma secuencia' })
  }

  const cajas = d.cajas ?? []
  const numerosCaja = cajas.map((c) => c.numeroSecuencia).filter((n): n is number => n !== undefined)
  if (new Set(numerosCaja).size !== numerosCaja.length) {
    throw createError({ statusCode: 400, statusMessage: 'No se permiten cajas con el mismo numeroSecuencia' })
  }

  const current = await prisma.gourmetPedido.findUnique({ where: { id }, select: { estado: true, updatedAt: true } })
  if (!current) throw createError({ statusCode: 404, statusMessage: 'No encontrado' })

  const destino: EstadoPedidoGourmet = 'UBICACION_ASIGNADA'
  const origen = current.estado as EstadoPedidoGourmet
  const check = assertTransicionGourmet(origen, destino, actor.role)
  if (!check.ok) {
    throw createError({ statusCode: check.motivo === 'SIN_PERMISO' ? 403 : 409, statusMessage: check.mensaje, data: { code: check.motivo } })
  }

  if (new Date(d.updatedAt).getTime() !== current.updatedAt.getTime()) {
    throw createError({ statusCode: 409, statusMessage: 'Conflicto: el pedido fue modificado por otro usuario', data: { code: 'CONFLICT' } })
  }

  // Detectar si el pedido ya tiene estibas pre-escaneadas desde la creación
  // (G2+): en ese caso, las estibas ya existen con sus cajas vinculadas; solo
  // hay que actualizar la ubicación de cada estiba por secuencia, sin borrar
  // las cajas. Si no hay estibas previas (pedido legacy), flujo clásico:
  // delete+create completo. Se consulta fuera de la transacción, igual que
  // en la app Next.js.
  const estibasPrevias = await prisma.gourmetPedidoEstiba.findMany({ where: { pedidoId: id }, select: { id: true, secuencia: true } })
  const tieneEscaneoInicial = estibasPrevias.length > 0

  const pedido = await prisma.$transaction(async (tx) => {
    if (tieneEscaneoInicial) {
      const secuenciaToId = new Map(estibasPrevias.map((e) => [e.secuencia, e.id]))
      for (const e of d.estibas) {
        const estibaId = secuenciaToId.get(e.secuencia)
        if (estibaId) {
          await tx.gourmetPedidoEstiba.update({ where: { id: estibaId }, data: { ubicacion: e.ubicacion ?? null, observacion: e.observacion ?? null } })
        } else {
          await tx.gourmetPedidoEstiba.create({ data: { pedidoId: id, secuencia: e.secuencia, ubicacion: e.ubicacion ?? null, observacion: e.observacion ?? null } })
        }
      }
      if (cajas.length > 0) {
        await tx.gourmetPedidoCaja.createMany({
          data: cajas.map((c) => ({ pedidoId: id, codigoCaja: c.codigoCaja ?? null, numeroSecuencia: c.numeroSecuencia ?? null })),
        })
      }
    } else {
      await tx.gourmetPedidoEstiba.deleteMany({ where: { pedidoId: id } })
      await tx.gourmetPedidoEstiba.createMany({
        data: d.estibas.map((e) => ({ pedidoId: id, secuencia: e.secuencia, ubicacion: e.ubicacion ?? null, observacion: e.observacion ?? null })),
      })
      await tx.gourmetPedidoCaja.deleteMany({ where: { pedidoId: id } })
      if (cajas.length > 0) {
        await tx.gourmetPedidoCaja.createMany({
          data: cajas.map((c) => ({ pedidoId: id, codigoCaja: c.codigoCaja ?? null, numeroSecuencia: c.numeroSecuencia ?? null })),
        })
      }
    }

    return tx.gourmetPedido.update({
      where: { id },
      data: { estado: 'UBICACION_ASIGNADA', ubicacionAsignadaAt: new Date(), ubicacionAsignadaPorId: actor.id },
      include: {
        estibas: { orderBy: { secuencia: 'asc' } },
        cajas: { orderBy: [{ numeroSecuencia: 'asc' }, { createdAt: 'asc' }] },
      },
    })
  })

  await prisma.activityLog.create({
    data: { userId: actor.id, action: 'UPDATE', module: 'cargue-gourmet', recordId: pedido.id, details: `Ubicación asignada — ${pedido.tipoOrden} ${pedido.orden} (${d.estibas.length} estiba(s))` },
  }).catch(() => {})

  return { success: true, data: mapPedido(pedido) }
})
