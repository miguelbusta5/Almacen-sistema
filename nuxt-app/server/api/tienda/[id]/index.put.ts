import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { mapDespacho, ESTADO_DESPACHO_LABEL } from '../../../utils/mapRow'
import { esTransicionValida, rolPuedeTransicionar, type EstadoDespacho } from '../../../utils/tiendaFlow'
import { getErrorCode } from '../../../utils/errors'

const updateSchema = z.object({
  estado: z.enum(['CREADO_TIENDA', 'RECHAZADO', 'RECOGIDO_TIENDA', 'ENTREGADO_CEDI', 'ENVIADO_CLIENTE', 'CON_NOVEDAD']).optional(),
  motivoRechazo: z.string().min(5).nullable().optional(),
  updatedAt: z.string().datetime().optional(),
  fotoRecogidaUrl: z.string().url().nullable().optional(),
  fotoCediUrl: z.string().url().nullable().optional(),
  recibidoPorCedi: z.string().max(255).nullable().optional(),
  observacionEntrega: z.string().nullable().optional(),
  novedad: z.string().nullable().optional(),
  netsuiteId: z.string().max(100).nullable().optional(),
  centroCostos: z.string().max(100).optional(),
  numeroDocumento: z.string().max(100).optional(),
  consecutivo: z.string().max(50).optional(),
  clienteNombre: z.string().max(255).optional(),
  clienteDocumento: z.string().max(50).nullable().optional(),
  clienteTelefono: z.string().max(30).nullable().optional(),
  fechaEntregaComprometida: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  numeroCajas: z.number().int().min(1).nullable().optional(),
  notaEntrega: z.string().nullable().optional(),
  direccionEntrega: z.string().nullable().optional(),
  barrio: z.string().nullable().optional(),
  ciudad: z.string().nullable().optional(),
  departamento: z.string().nullable().optional(),
  latitud: z.number().nullable().optional(),
  longitud: z.number().nullable().optional(),
  contactoEntrega: z.string().nullable().optional(),
  telefonoEntrega: z.string().max(30).nullable().optional(),
})

const BASIC_EDIT_KEYS = [
  'centroCostos', 'numeroDocumento', 'consecutivo', 'clienteNombre',
  'clienteDocumento', 'clienteTelefono', 'fechaEntregaComprometida',
  'numeroCajas', 'notaEntrega', 'direccionEntrega', 'barrio', 'ciudad',
  'departamento', 'latitud', 'longitud', 'contactoEntrega', 'telefonoEntrega',
] as const

// PUT /api/tienda/[id]
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const parsed = updateSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  const d = parsed.data

  const current = await prisma.despachoTienda.findUnique({
    where: { id },
    select: { estado: true, updatedAt: true, creadoPorId: true, numeroDocumento: true },
  })
  if (!current) throw createError({ statusCode: 404, statusMessage: 'No encontrado' })

  if (d.estado && d.estado !== current.estado) {
    const origen = current.estado as EstadoDespacho
    const destino = d.estado as EstadoDespacho

    if (!esTransicionValida(origen, destino)) {
      throw createError({ statusCode: 400, statusMessage: `Transición inválida: ${origen} → ${destino}`, data: { code: 'INVALID_TRANSITION' } })
    }
    if (!rolPuedeTransicionar(actor.role, origen, destino)) {
      throw createError({ statusCode: 403, statusMessage: 'Sin permiso para esta transición de estado' })
    }
    if (destino === 'CON_NOVEDAD' && (!d.novedad || d.novedad.trim().length < 5)) {
      throw createError({ statusCode: 400, statusMessage: 'Descripción de novedad obligatoria (mínimo 5 caracteres)' })
    }
    if (destino === 'RECHAZADO' && (!d.motivoRechazo?.trim() || d.motivoRechazo.trim().length < 5)) {
      throw createError({ statusCode: 400, statusMessage: 'Debes indicar el motivo del rechazo (mínimo 5 caracteres)' })
    }
  }

  const isDataEdit = BASIC_EDIT_KEYS.some((key) => d[key] !== undefined)
  if (isDataEdit) {
    const puedeEditarBasico = ['TIENDA', 'SUPERVISOR_TIENDA', 'SUPERVISOR_TRANSPORTE', 'GERENTE', 'ADMIN'].includes(actor.role)
    if (!puedeEditarBasico) throw createError({ statusCode: 403, statusMessage: 'Sin permiso para editar datos de tienda' })
    if (actor.role === 'TIENDA' && current.estado !== 'RECHAZADO') {
      throw createError({ statusCode: 409, statusMessage: 'TIENDA solo puede editar solicitudes rechazadas' })
    }
    if (actor.role !== 'TIENDA' && current.estado !== 'CREADO_TIENDA' && current.estado !== 'RECHAZADO' && !['GERENTE', 'ADMIN'].includes(actor.role)) {
      throw createError({ statusCode: 409, statusMessage: 'Solo se puede editar información básica mientras el despacho está en CREADO_TIENDA o RECHAZADO' })
    }
  }

  const timestamps: Record<string, unknown> = {}
  if (d.estado === 'RECOGIDO_TIENDA') timestamps.recibidoAt = new Date()
  if (d.estado === 'ENTREGADO_CEDI') timestamps.entregadoCediAt = new Date()
  if (d.estado === 'ENVIADO_CLIENTE') timestamps.despachadoAt = new Date()
  if (d.estado === 'CON_NOVEDAD') timestamps.novedadAt = new Date()
  if (d.estado === 'RECHAZADO') { timestamps.rechazadoAt = new Date(); timestamps.motivoRechazo = d.motivoRechazo!.trim() }
  if (current.estado === 'RECHAZADO' && d.estado === 'CREADO_TIENDA') { timestamps.motivoRechazo = null; timestamps.rechazadoAt = null }

  try {
    const estadoCambia = !!d.estado && d.estado !== current.estado
    const lockUpdatedAt = d.updatedAt ? new Date(d.updatedAt) : undefined

    const [updatedRow] = await prisma.$transaction([
      prisma.despachoTienda.update({
        where: { id, ...(lockUpdatedAt ? { updatedAt: lockUpdatedAt } : {}) },
        data: {
          ...(d.estado !== undefined && { estado: d.estado }),
          ...(d.novedad !== undefined && { novedad: d.novedad }),
          ...(d.netsuiteId !== undefined && { netsuiteId: d.netsuiteId }),
          ...(d.fotoRecogidaUrl !== undefined && { fotoRecogidaUrl: d.fotoRecogidaUrl }),
          ...(d.fotoCediUrl !== undefined && { fotoCediUrl: d.fotoCediUrl }),
          ...(d.recibidoPorCedi !== undefined && { recibidoPorCedi: d.recibidoPorCedi }),
          ...(d.observacionEntrega !== undefined && { observacionEntrega: d.observacionEntrega }),
          ...(d.centroCostos && { centroCostos: d.centroCostos }),
          ...(d.numeroDocumento && { numeroDocumento: d.numeroDocumento }),
          ...(d.consecutivo && { consecutivo: d.consecutivo }),
          ...(d.clienteNombre && { clienteNombre: d.clienteNombre }),
          ...(d.clienteDocumento !== undefined && { clienteDocumento: d.clienteDocumento }),
          ...(d.clienteTelefono !== undefined && { clienteTelefono: d.clienteTelefono }),
          ...(d.fechaEntregaComprometida !== undefined && {
            fechaEntregaComprometida: d.fechaEntregaComprometida ? new Date(d.fechaEntregaComprometida + 'T00:00:00') : null,
          }),
          ...(d.numeroCajas !== undefined && { numeroCajas: d.numeroCajas }),
          ...(d.notaEntrega !== undefined && { notaEntrega: d.notaEntrega }),
          ...(d.direccionEntrega !== undefined && { direccionEntrega: d.direccionEntrega }),
          ...(d.barrio !== undefined && { barrio: d.barrio }),
          ...(d.ciudad !== undefined && { ciudad: d.ciudad }),
          ...(d.departamento !== undefined && { departamento: d.departamento }),
          ...(d.latitud !== undefined && { latitud: d.latitud }),
          ...(d.longitud !== undefined && { longitud: d.longitud }),
          ...(d.contactoEntrega !== undefined && { contactoEntrega: d.contactoEntrega }),
          ...(d.telefonoEntrega !== undefined && { telefonoEntrega: d.telefonoEntrega }),
          ...timestamps,
        },
        include: {
          creadoPor: { select: { id: true, name: true } },
          plines: true,
          guardadoPendiente: { include: { asignadoA: { select: { name: true } } } },
        },
      }),
      ...(estadoCambia ? [prisma.historialDespacho.create({
        data: {
          despachoId: id,
          estadoAnterior: current.estado,
          estadoNuevo: d.estado!,
          observacion: d.observacionEntrega ?? d.novedad ?? null,
          usuarioId: actor.id,
        },
      })] : []),
    ])

    const detail = d.estado ? `Estado → ${ESTADO_DESPACHO_LABEL[d.estado] ?? d.estado}` : 'Actualización'
    await prisma.activityLog.create({
      data: { userId: actor.id, action: 'UPDATE', module: 'tienda', recordId: id, details: detail },
    }).catch(() => {})

    if (d.estado === 'RECHAZADO' && current.creadoPorId) {
      prisma.notificacion.create({
        data: {
          userId: current.creadoPorId,
          titulo: 'Despacho rechazado por transporte',
          descripcion: `Doc. ${current.numeroDocumento}: ${(d.motivoRechazo ?? '').substring(0, 200)}`,
          tipo: 'TIENDA',
          enlace: '/dashboard/tienda',
          leida: false,
        },
      }).catch(() => {})
    }

    if (estadoCambia && d.estado === 'CON_NOVEDAD') {
      const destinatariosIds = new Set<string>()
      if (current.creadoPorId) destinatariosIds.add(current.creadoPorId)
      const supervisores = await prisma.user.findMany({
        where: { active: true, role: { in: ['SUPERVISOR_TIENDA'] } },
        select: { id: true },
      }).catch(() => [])
      supervisores.forEach((u) => destinatariosIds.add(u.id))
      destinatariosIds.delete(actor.id)
      if (destinatariosIds.size > 0) {
        await prisma.notificacion.createMany({
          data: Array.from(destinatariosIds).map((userId) => ({
            userId,
            titulo: 'Novedad registrada en factura',
            descripcion: `Doc. ${current.numeroDocumento}: ${(d.novedad ?? '').substring(0, 200)}`,
            tipo: 'TIENDA',
            enlace: '/dashboard/tienda',
          })),
        }).catch(() => {})
      }
    }

    if (estadoCambia && d.estado === 'ENVIADO_CLIENTE' && current.creadoPorId && current.creadoPorId !== actor.id) {
      await prisma.notificacion.create({
        data: {
          userId: current.creadoPorId,
          titulo: 'Factura enviada al cliente',
          descripcion: `Doc. ${current.numeroDocumento} completó el flujo CEDI`,
          tipo: 'TIENDA',
          enlace: '/dashboard/tienda',
          leida: false,
        },
      }).catch(() => {})
    }

    return { success: true, data: mapDespacho(updatedRow) }
  } catch (e) {
    if (getErrorCode(e) === 'P2025') {
      throw createError({ statusCode: 409, statusMessage: 'Conflicto: el despacho fue modificado por otro usuario', data: { code: 'CONFLICT' } })
    }
    throw e
  }
})
