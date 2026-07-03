import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'

const assignSchema = z.object({
  asignadoAId: z.string().min(1),
  nota: z.string().nullable().optional(),
})

function canAssign(role: string) {
  return ['SUPERVISOR_TRANSPORTE', 'GERENTE', 'ADMIN'].includes(role)
}

// POST /api/tienda/[id]/guardado — asigna el despacho a un operario de Transporte
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  if (!canAssign(actor.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Sin permiso para asignar guardado' })
  }
  const id = getRouterParam(event, 'id')!
  const parsed = assignSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })

  const [despacho, operario] = await Promise.all([
    prisma.despachoTienda.findUnique({ where: { id }, select: { id: true, estado: true, numeroDocumento: true, clienteNombre: true } }),
    prisma.user.findUnique({ where: { id: parsed.data.asignadoAId }, select: { id: true, role: true, active: true, name: true } }),
  ])
  if (!despacho) throw createError({ statusCode: 404, statusMessage: 'Despacho no encontrado' })
  if (!operario || !operario.active || operario.role !== 'TRANSPORTE') {
    throw createError({ statusCode: 400, statusMessage: 'Selecciona un operario activo con rol TRANSPORTE' })
  }
  if (despacho.estado !== 'ENTREGADO_CEDI') {
    throw createError({ statusCode: 409, statusMessage: 'Solo se puede enviar a guardado un despacho entregado en CEDI' })
  }

  const pendiente = await prisma.guardadoPendienteTienda.upsert({
    where: { despachoId: id },
    update: {
      asignadoAId: operario.id,
      asignadoPorId: actor.id,
      estado: 'PENDIENTE',
      guardadoClientId: null,
      completadoAt: null,
      nota: parsed.data.nota ?? null,
    },
    create: {
      despachoId: id,
      asignadoAId: operario.id,
      asignadoPorId: actor.id,
      nota: parsed.data.nota ?? null,
    },
    include: { asignadoA: { select: { id: true, name: true, email: true } } },
  })

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: 'ASSIGN_GUARDADO',
      module: 'tienda',
      recordId: id,
      details: `${despacho.numeroDocumento} asignado a ${pendiente.asignadoA.name}`,
    },
  }).catch(() => {})

  if (operario.id !== actor.id) {
    await prisma.notificacion.create({
      data: {
        userId: operario.id,
        titulo: 'Te asignaron un guardado',
        descripcion: `Doc. ${despacho.numeroDocumento} · ${despacho.clienteNombre}${parsed.data.nota ? ` · ${parsed.data.nota.substring(0, 120)}` : ''}`,
        tipo: 'TIENDA',
        enlace: '/dashboard/transporte',
        leida: false,
      },
    }).catch(() => {})
  }

  return {
    success: true,
    data: {
      id: pendiente.id,
      despachoId: pendiente.despachoId,
      asignadoAId: pendiente.asignadoAId,
      asignadoANombre: pendiente.asignadoA.name,
      estado: pendiente.estado,
      nota: pendiente.nota,
      createdAt: pendiente.createdAt.toISOString(),
    },
  }
})
