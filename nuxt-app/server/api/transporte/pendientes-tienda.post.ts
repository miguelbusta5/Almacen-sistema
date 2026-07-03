import { defineEventHandler, readBody, createError, setResponseStatus } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { canViewPendientes } from '../../utils/permissions'

const convertSchema = z.object({
  pendienteId: z.string().cuid(),
  ubicacion: z.string().min(1, 'Ubicación requerida'),
  nota: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  if (!canViewPendientes(actor.role)) throw createError({ statusCode: 403, statusMessage: 'Sin permiso' })

  const parsed = convertSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  const { pendienteId, ubicacion, nota } = parsed.data

  try {
    const result = await prisma.$transaction(async (tx: any) => {
      const pendiente = await tx.guardadoPendienteTienda.findUnique({
        where: { id: pendienteId },
        include: { despacho: { include: { plines: true } } },
      })
      if (!pendiente) throw new Error('PENDIENTE_NOT_FOUND')
      if (pendiente.estado !== 'PENDIENTE') throw new Error('PENDIENTE_CLOSED')
      if (actor.role === 'TRANSPORTE' && pendiente.asignadoAId !== actor.id) throw new Error('PENDIENTE_FORBIDDEN')

      const d = pendiente.despacho
      const clientId = `td-${d.id.slice(-10)}-${Date.now().toString(36)}`
      const notaFinal = [
        `Origen: despacho tienda ${d.numeroDocumento}`,
        `Cliente: ${d.clienteNombre}`,
        d.clienteTelefono ? `Telefono: ${d.clienteTelefono}` : null,
        d.notaEntrega ? `Nota entrega: ${d.notaEntrega}` : null,
        pendiente.nota ? `Nota supervisor: ${pendiente.nota}` : null,
        nota ? `Nota guardado: ${nota}` : null,
        d.plines.length > 0 ? `PLUs: ${d.plines.map((p: any) => `${p.plu} x${p.unidades}`).join(', ')}` : null,
      ].filter(Boolean).join('\n')

      const guardado = await tx.transporteGuardado.create({
        data: {
          client_id: clientId, fecha: new Date(), documento: d.numeroDocumento,
          ubicacion, estado: 'PENDIENTE DESPACHO', tipo: 'ECOMMERCE',
          nota: notaFinal, netsuiteId: d.netsuiteId ?? null,
        },
      })
      const cerrado = await tx.guardadoPendienteTienda.update({
        where: { id: pendiente.id },
        data: { estado: 'CONVERTIDO', guardadoClientId: clientId, completadoAt: new Date() },
        include: { asignadoA: { select: { id: true, name: true } }, despacho: true },
      })
      await tx.activityLog.create({
        data: { userId: actor.id, action: 'CONVERT_TO_GUARDADO', module: 'transporte', recordId: clientId, details: `${d.numeroDocumento} desde despacho tienda` },
      }).catch(() => {})
      return { guardado, pendiente: cerrado }
    })

    setResponseStatus(event, 201)
    return {
      success: true,
      data: { clientId: result.guardado.client_id, documento: result.guardado.documento, ubicacion: result.guardado.ubicacion },
    }
  } catch (e: any) {
    const msg = e?.message
    if (msg === 'PENDIENTE_NOT_FOUND') throw createError({ statusCode: 404, statusMessage: 'Pendiente no encontrado' })
    if (msg === 'PENDIENTE_CLOSED') throw createError({ statusCode: 409, statusMessage: 'Este pendiente ya fue convertido' })
    if (msg === 'PENDIENTE_FORBIDDEN') throw createError({ statusCode: 403, statusMessage: 'Este pendiente no está asignado a tu usuario' })
    throw e
  }
})
