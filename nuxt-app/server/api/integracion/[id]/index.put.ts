import { defineEventHandler, readBody, getRouterParam, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'
import { areaFromRole, canSeeIntegracion } from '../../../utils/integracion'
import { mapIntegracion } from '../../../utils/mapRow'

const TRANSPORT_ROLES = ['SUPERVISOR_TRANSPORTE', 'TRANSPORTE', 'ADMIN', 'GERENTE']

const plinSchema = z.object({
  plu: z.string().min(1).max(100),
  descripcion: z.string().max(255).nullable().optional(),
  unidades: z.number().int().min(1),
})

const completarArea2Schema = z.object({
  accion: z.literal('COMPLETAR_AREA2'),
  numeroCajasArea2: z.number().int().min(1).nullable().optional(),
  plines: z.array(plinSchema).min(1),
  observaciones: z.string().nullable().optional(),
})
const marcarCompletadaSchema = z.object({
  accion: z.literal('MARCAR_COMPLETADA'),
  observaciones: z.string().nullable().optional(),
})
const editarSchema = z.object({
  accion: z.literal('EDITAR'),
  numeroDocumento: z.string().min(1).max(100),
  tipoDocumento: z.enum(['OVDM', 'TSDM']),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  numeroCajasArea1: z.number().int().min(1).nullable().optional(),
  numeroCajasArea2: z.number().int().min(1).nullable().optional(),
  observaciones: z.string().nullable().optional(),
  plines: z.array(plinSchema.extend({ area: z.enum(['MUEBLES', 'GOURMET']) })),
})
const putSchema = z.discriminatedUnion('accion', [completarArea2Schema, marcarCompletadaSchema, editarSchema])

// PUT /api/integracion/[id] — 3 acciones sobre el mismo recurso (mismo
// patrón que el endpoint Next.js original): COMPLETAR_AREA2, MARCAR_COMPLETADA, EDITAR.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  if (!canSeeIntegracion(actor.role)) throw createError({ statusCode: 403, statusMessage: 'Sin acceso' })

  const id = getRouterParam(event, 'id')!
  const parsed = putSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })

  const rec = await prisma.integracionPedido.findUnique({ where: { id }, include: { plines: true } })
  if (!rec) throw createError({ statusCode: 404, statusMessage: 'No encontrado' })

  // ── COMPLETAR_AREA2 ────────────────────────────────────────────────
  if (parsed.data.accion === 'COMPLETAR_AREA2') {
    if (rec.estado !== 'PENDIENTE_AREA2') {
      throw createError({ statusCode: 409, statusMessage: 'Solo se puede completar cuando el estado es PENDIENTE_AREA2' })
    }
    const areaContraria = rec.areaIniciadora === 'MUEBLES' ? 'GOURMET' : 'MUEBLES'
    const actorArea = areaFromRole(actor.role)
    if (actorArea !== null && actorArea !== areaContraria) {
      throw createError({ statusCode: 403, statusMessage: 'Solo el área contraria a la iniciadora puede completar' })
    }
    const areaUsada = actorArea ?? areaContraria
    const d = parsed.data
    const now = new Date()

    const updated = await prisma.$transaction(async (tx) => {
      await tx.plinIntegracion.createMany({
        data: d.plines.map((p) => ({ integracionId: id, area: areaUsada, plu: p.plu, descripcion: p.descripcion ?? null, unidades: p.unidades })),
      })
      return tx.integracionPedido.update({
        where: { id },
        data: {
          estado: 'LISTA_TRANSPORTE',
          numeroCajasArea2: d.numeroCajasArea2 ?? null,
          completadoPorId: actor.id,
          completadoAt: now,
          entregadoATransporteAt: now,
          observaciones: d.observaciones ?? rec.observaciones,
        },
        include: { plines: true, creadoPor: { select: { name: true } }, completadoPor: { select: { name: true } } },
      })
    })

    const destinatarios = await prisma.user.findMany({
      where: { active: true, role: { in: ['SUPERVISOR_TRANSPORTE', 'TRANSPORTE', 'ADMIN', 'GERENTE'] } },
      select: { id: true },
    })
    if (destinatarios.length > 0) {
      await prisma.notificacion.createMany({
        data: destinatarios.map((u) => ({
          userId: u.id,
          titulo: 'Integración lista para transporte',
          descripcion: `${rec.tipoDocumento} ${rec.numeroDocumento} — Área 2 completó su picking`,
          tipo: 'INTEGRACION',
          enlace: '/dashboard/integracion',
        })),
      })
    }

    await prisma.activityLog.create({
      data: { userId: actor.id, action: 'COMPLETE_AREA2', module: 'integracion', recordId: id, details: `${rec.tipoDocumento} ${rec.numeroDocumento}` },
    }).catch(() => {})

    return { success: true, data: mapIntegracion(updated) }
  }

  // ── MARCAR_COMPLETADA ──────────────────────────────────────────────
  if (parsed.data.accion === 'MARCAR_COMPLETADA') {
    if (rec.estado !== 'LISTA_TRANSPORTE') {
      throw createError({ statusCode: 409, statusMessage: 'Solo se puede marcar completada cuando el estado es LISTA_TRANSPORTE' })
    }
    if (!TRANSPORT_ROLES.includes(actor.role)) {
      throw createError({ statusCode: 403, statusMessage: 'Solo transporte puede marcar como completada' })
    }

    const updated = await prisma.integracionPedido.update({
      where: { id },
      data: {
        estado: 'COMPLETADA',
        marcadoCompletadoPorId: actor.id,
        marcadoCompletadoAt: new Date(),
        observaciones: parsed.data.observaciones ?? rec.observaciones,
      },
      include: { plines: true, creadoPor: { select: { name: true } }, completadoPor: { select: { name: true } } },
    })

    await prisma.activityLog.create({
      data: { userId: actor.id, action: 'MARK_COMPLETE', module: 'integracion', recordId: id, details: `${rec.tipoDocumento} ${rec.numeroDocumento}` },
    }).catch(() => {})

    return { success: true, data: mapIntegracion(updated) }
  }

  // ── EDITAR ───────────────────────────────────────────────────────
  if (parsed.data.accion === 'EDITAR') {
    if (!['ADMIN', 'GERENTE'].includes(actor.role)) {
      throw createError({ statusCode: 403, statusMessage: 'Solo ADMIN o GERENTE pueden editar una integración' })
    }
    if (rec.estado === 'COMPLETADA') {
      throw createError({ statusCode: 409, statusMessage: 'No se puede editar una integración completada' })
    }
    const d = parsed.data

    if (d.numeroDocumento !== rec.numeroDocumento || d.tipoDocumento !== rec.tipoDocumento) {
      const duplicado = await prisma.integracionPedido.findFirst({
        where: { id: { not: id }, numeroDocumento: d.numeroDocumento, estado: { in: ['PENDIENTE_AREA2', 'LISTA_TRANSPORTE'] } },
      })
      if (duplicado) throw createError({ statusCode: 409, statusMessage: 'Ya existe otra integración activa con este número de documento' })
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.plinIntegracion.deleteMany({ where: { integracionId: id } })
      if (d.plines.length > 0) {
        await tx.plinIntegracion.createMany({
          data: d.plines.map((p) => ({ integracionId: id, area: p.area, plu: p.plu, descripcion: p.descripcion ?? null, unidades: p.unidades })),
        })
      }
      return tx.integracionPedido.update({
        where: { id },
        data: {
          numeroDocumento: d.numeroDocumento,
          tipoDocumento: d.tipoDocumento,
          fecha: new Date(d.fecha),
          numeroCajasArea1: d.numeroCajasArea1 ?? null,
          numeroCajasArea2: d.numeroCajasArea2 ?? null,
          observaciones: d.observaciones ?? null,
        },
        include: { plines: true, creadoPor: { select: { name: true } }, completadoPor: { select: { name: true } } },
      })
    })

    await prisma.activityLog.create({
      data: { userId: actor.id, action: 'EDIT', module: 'integracion', recordId: id, details: `${updated.tipoDocumento} ${updated.numeroDocumento}` },
    }).catch(() => {})

    return { success: true, data: mapIntegracion(updated) }
  }

  throw createError({ statusCode: 400, statusMessage: 'Acción no reconocida' })
})
