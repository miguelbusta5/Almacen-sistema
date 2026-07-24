import { defineEventHandler, readBody, createError, setResponseStatus } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { areaFromRole, canSeeIntegracion } from '../../utils/integracion'
import { mapIntegracion } from '../../utils/mapRow'

const ALLOWED_ROLES = ['OPERACIONES_MUEBLES', 'OPERACIONES_GOURMET', 'ADMIN', 'GERENTE', 'SUPERVISOR_TRANSPORTE', 'TRANSPORTE']

const plinSchema = z.object({
  plu: z.string().min(1).max(100),
  descripcion: z.string().max(255).nullable().optional(),
  unidades: z.number().int().min(1),
})

const createSchema = z.object({
  numeroDocumento: z.string().min(1).max(100),
  tipoDocumento: z.enum(['OVDM', 'TSDM']),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  areaIniciadora: z.enum(['MUEBLES', 'GOURMET']).optional(),
  numeroCajas: z.number().int().min(1).nullable().optional(),
  plines: z.array(plinSchema).min(1),
  observaciones: z.string().nullable().optional(),
})

// POST /api/integracion — crea una integración; si ya existe una pendiente
// del área contraria para el mismo documento, responde 409 con
// { pendiente: true, integracion } para que el cliente abra directamente el
// modal de "Completar Área 2" en vez de mostrar un error.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  if (!canSeeIntegracion(actor.role) || !ALLOWED_ROLES.includes(actor.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Sin acceso' })
  }

  const parsed = createSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  const data = parsed.data

  const areaFromActor = areaFromRole(actor.role)
  const areaIniciadora = areaFromActor ?? data.areaIniciadora
  if (!areaIniciadora) throw createError({ statusCode: 400, statusMessage: 'Debe especificar areaIniciadora' })
  const areaContraria = areaIniciadora === 'MUEBLES' ? 'GOURMET' : 'MUEBLES'

  const existing = await prisma.integracionPedido.findFirst({
    where: { numeroDocumento: data.numeroDocumento, estado: { in: ['PENDIENTE_AREA2', 'LISTA_TRANSPORTE'] } },
    include: { creadoPor: { select: { name: true } }, plines: true },
  })

  if (existing) {
    if (existing.areaIniciadora === areaIniciadora) {
      setResponseStatus(event, 409)
      return { error: 'Ya existe una solicitud creada por su misma área para este documento', integracion: mapIntegracion(existing) }
    }
    setResponseStatus(event, 409)
    return { exists: true, pendiente: true, integracion: mapIntegracion(existing) }
  }

  const integracion = await prisma.$transaction(async (tx) => {
    return tx.integracionPedido.create({
      data: {
        numeroDocumento: data.numeroDocumento,
        tipoDocumento: data.tipoDocumento,
        fecha: new Date(data.fecha),
        areaIniciadora,
        numeroCajasArea1: data.numeroCajas ?? null,
        creadoPorId: actor.id,
        observaciones: data.observaciones ?? null,
        plines: {
          create: data.plines.map((p) => ({
            area: areaIniciadora, plu: p.plu, descripcion: p.descripcion ?? null, unidades: p.unidades,
          })),
        },
      },
      include: { plines: true, creadoPor: { select: { name: true } } },
    })
  })

  const areaRol = areaContraria === 'MUEBLES' ? 'OPERACIONES_MUEBLES' : 'OPERACIONES_GOURMET'
  const destinatarios = await prisma.user.findMany({
    where: { active: true, role: { in: [areaRol, 'ADMIN', 'GERENTE'] } },
    select: { id: true },
  })
  if (destinatarios.length > 0) {
    await prisma.notificacion.createMany({
      data: destinatarios.map((u) => ({
        userId: u.id,
        titulo: 'Nueva integración de pedido',
        descripcion: `Área ${areaIniciadora} creó solicitud para ${data.tipoDocumento} ${data.numeroDocumento}`,
        tipo: 'INTEGRACION',
        enlace: '/dashboard/integracion',
      })),
    })
  }

  await prisma.activityLog.create({
    data: {
      userId: actor.id, action: 'CREATE', module: 'integracion', recordId: integracion.id,
      details: `${data.tipoDocumento} ${data.numeroDocumento} — área ${areaIniciadora}`,
    },
  }).catch(() => {})

  setResponseStatus(event, 201)
  return { success: true, data: mapIntegracion(integracion) }
})
