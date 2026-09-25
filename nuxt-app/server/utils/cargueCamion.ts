// Cargue de camiones — capa con base de datos (25-09-2026). Lo puro vive en
// cargueCamionCalc.ts; aqui no se re-exporta nada de alli (los auto-imports
// de Nitro se duplicarian).
import { createError, type H3Event } from 'h3'
import { prisma } from './prisma'
import { requireAuth, type SessionUser } from './auth'
import {
  bultosMuebles, esGestionCargue, gourmetCargable, mueblesCargable, normalizarCodigoCargue, origenDe,
  puedeCargarCamiones, tipoOrdenCargue, type OrigenCargue,
} from './cargueCamionCalc'

export const CARGUE_INCLUDE = {
  creadoPor: { select: { id: true, name: true } },
  cerradoPor: { select: { id: true, name: true } },
  operarios: { include: { operario: { select: { id: true, nombre: true } } }, orderBy: { createdAt: 'asc' } },
  ordenes: { orderBy: { horaInicio: 'asc' } },
} as const

export async function requireCargue(event: H3Event): Promise<SessionUser> {
  const actor = await requireAuth(event)
  if (!puedeCargarCamiones(actor.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Sin acceso a Cargue de camiones' })
  }
  return actor
}

export async function requireGestionCargue(event: H3Event, mensaje = 'Solo supervision de transporte'): Promise<SessionUser> {
  const actor = await requireCargue(event)
  if (!esGestionCargue(actor.role)) throw createError({ statusCode: 403, statusMessage: mensaje })
  return actor
}

export async function camionPorId(id: string) {
  const c = await prisma.cargueCamion.findFirst({ where: { id, deletedAt: null }, include: CARGUE_INCLUDE })
  if (!c) throw createError({ statusCode: 404, statusMessage: 'Camion no encontrado' })
  return c
}

export async function auditarCargue(userId: string, action: string, recordId: string, details: string) {
  await prisma.activityLog.create({
    data: { userId, action, module: 'cargue-camiones', recordId, details },
  }).catch(() => {})
}

export interface OrdenEncontrada {
  codigo: string
  tipoOrden: string
  origen: OrigenCargue
  gourmetPedidoId: string | null
  ordenMueblesId: string | null
  tienda: string | null
  cliente: string | null
  ciudad: string | null
  bultosGourmet: number | null
  bultosMuebles: number | null
  bultosDeclarados: number | null
  /** Por que no se puede subir (si existe pero no esta lista), o null. */
  bloqueo: string | null
  /** Camion en que ya se cargo, si se cargo. */
  yaCargadaEn: { cargueId: string; placa: string | null; fecha: string } | null
}

/**
 * Busca la orden en Cargue Gourmet y en Muebles y trae lo que sube al camion:
 * tienda, cliente, ciudad y los bultos que declara cada uno.
 */
export async function buscarOrdenCargue(entrada: string): Promise<OrdenEncontrada> {
  const codigo = normalizarCodigoCargue(entrada)
  const [pedidos, muebles, previa] = await Promise.all([
    prisma.gourmetPedido.findMany({
      where: { orden: { equals: codigo, mode: 'insensitive' }, estado: { not: 'CANCELADO' } },
      select: { id: true, estado: true, nombreTienda: true, codigoTienda: true, ciudadDestino: true, cajasEsperadas: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.ordenMuebles.findFirst({
      where: { codigo, deletedAt: null },
      select: {
        id: true, estado: true, cliente: true, ciudadEnvio: true, tiendaOrigenNombre: true, tiendaDestinoNombre: true,
        lineas: { select: { plu: true, unidades: true, partes: true } },
      },
    }),
    prisma.cargueCamionOrden.findFirst({
      where: { codigo, cargue: { deletedAt: null } },
      select: { cargueId: true, cargue: { select: { placa: true, fecha: true } } },
      orderBy: { horaInicio: 'desc' },
    }),
  ])
  const pedido = pedidos[0] ?? null
  const bloqueos: string[] = []
  if (pedido && !gourmetCargable(pedido.estado)) bloqueos.push(`el pedido de Cargue Gourmet esta en ${pedido.estado.replace(/_/g, ' ').toLowerCase()}`)
  if (muebles && !mueblesCargable(muebles.estado)) bloqueos.push(`la orden de muebles sigue ${muebles.estado === 'EN_PICKING' ? 'en picking' : 'en inspeccion'}`)

  const bGourmet = pedido ? pedido.cajasEsperadas : null
  const porCaja = muebles?.lineas.length
    ? new Map((await prisma.productoMaestro.findMany({
        where: { plu: { in: [...new Set(muebles.lineas.map((l) => l.plu))] } },
        select: { plu: true, unidadesPorCaja: true },
      })).map((p) => [p.plu, p.unidadesPorCaja]))
    : new Map<string, number | null>()
  const bMuebles = muebles
    ? bultosMuebles(muebles.lineas.map((l) => ({ ...l, unidadesPorCaja: porCaja.get(l.plu) ?? null })))
    : null
  const declarados = bGourmet == null && bMuebles == null ? null : (bGourmet ?? 0) + (bMuebles ?? 0)
  const tiendaGourmet = pedido && !['CLIENTE', 'INSTITUCIONAL'].includes(pedido.codigoTienda.toUpperCase()) ? pedido.nombreTienda : null

  return {
    codigo,
    tipoOrden: tipoOrdenCargue(codigo),
    origen: origenDe(!!pedido, !!muebles),
    gourmetPedidoId: pedido?.id ?? null,
    ordenMueblesId: muebles?.id ?? null,
    // Muebles: la tienda destino que eligio el inspector (25-09).
    tienda: tiendaGourmet ?? muebles?.tiendaDestinoNombre ?? null,
    cliente: muebles?.cliente ?? (pedido && pedido.codigoTienda.toUpperCase() === 'CLIENTE' ? 'Cliente final' : null),
    ciudad: pedido?.ciudadDestino && pedido.ciudadDestino !== 'CLIENTE' ? pedido.ciudadDestino : (muebles?.ciudadEnvio ?? null),
    bultosGourmet: bGourmet,
    bultosMuebles: bMuebles,
    bultosDeclarados: declarados,
    bloqueo: bloqueos.length ? `No se puede cargar: ${bloqueos.join(' y ')}` : null,
    yaCargadaEn: previa ? { cargueId: previa.cargueId, placa: previa.cargue.placa, fecha: previa.cargue.fecha.toISOString().slice(0, 10) } : null,
  }
}

export interface OrdenCargueDTO {
  id: string
  codigo: string
  tipoOrden: string
  origen: string
  tienda: string | null
  cliente: string | null
  ciudad: string | null
  bultosGourmet: number | null
  bultosMuebles: number | null
  bultosDeclarados: number | null
  bultosCargados: number | null
  notaDiferencia: string | null
  m3: number | null
  kg: number | null
  valorOvdm: number | null
  horaInicio: string
  horaFin: string | null
}

export interface CargueCamionDTO {
  id: string
  estado: string
  tipoVehiculo: string
  transportadora: string
  placa: string | null
  observacion: string | null
  fecha: string
  horaInicio: string
  horaFinalizacion: string | null
  creadoPor: { id: string; nombre: string } | null
  cerradoPor: { id: string; nombre: string } | null
  operarios: Array<{ id: string; nombre: string }>
  /** Quienes cargan sin estar en el catalogo (nombre a mano). */
  otrosOperarios: string[]
  ordenes: OrdenCargueDTO[]
}

/**
 * Serializa un camion para la pantalla. Con tipo explicito a proposito: el
 * $fetch tipado de Nuxt arrastra el tipo de respuesta de cada ruta, y uno
 * inferido de Prisma lo volvia tan profundo que rompia el chequeo de tipos.
 */
export function mapCargue(c: Awaited<ReturnType<typeof camionPorId>>): CargueCamionDTO {
  const num = (v: unknown) => (v == null ? null : Number(v))
  return {
    id: c.id,
    estado: c.estado,
    tipoVehiculo: c.tipoVehiculo,
    transportadora: c.transportadora,
    placa: c.placa,
    observacion: c.observacion,
    fecha: c.fecha.toISOString().slice(0, 10),
    horaInicio: c.horaInicio.toISOString(),
    horaFinalizacion: c.horaFinalizacion?.toISOString() ?? null,
    creadoPor: c.creadoPor ? { id: c.creadoPor.id, nombre: c.creadoPor.name } : null,
    cerradoPor: c.cerradoPor ? { id: c.cerradoPor.id, nombre: c.cerradoPor.name } : null,
    operarios: c.operarios.map((o) => ({ id: o.operario.id, nombre: o.operario.nombre })),
    otrosOperarios: c.otrosOperarios ?? [],
    ordenes: c.ordenes.map((o) => ({
      id: o.id,
      codigo: o.codigo,
      tipoOrden: o.tipoOrden,
      origen: o.origen,
      tienda: o.tienda,
      cliente: o.cliente,
      ciudad: o.ciudad,
      bultosGourmet: o.bultosGourmet,
      bultosMuebles: o.bultosMuebles,
      bultosDeclarados: o.bultosDeclarados,
      bultosCargados: o.bultosCargados,
      notaDiferencia: o.notaDiferencia,
      m3: num(o.m3),
      kg: num(o.kg),
      valorOvdm: num(o.valorOvdm),
      horaInicio: o.horaInicio.toISOString(),
      horaFin: o.horaFin?.toISOString() ?? null,
    })),
  }
}
