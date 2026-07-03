import { defineEventHandler, readBody, getRouterParam, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { requireAuth } from '../../../utils/auth'

const schema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('despachar'), fechaDespacho: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }),
  z.object({ tipo: z.literal('fecha_entrega'), fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
])

// POST /api/transporte/[clientId]/acciones — despachar o editar fecha de entrega.
export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  const clientId = getRouterParam(event, 'clientId')!
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })

  const guardado = await prisma.transporteGuardado.findUnique({ where: { client_id: clientId } })
  if (!guardado) throw createError({ statusCode: 404, statusMessage: 'No encontrado' })

  if (parsed.data.tipo === 'despachar') {
    if (guardado.estado === 'DESPACHADO') throw createError({ statusCode: 400, statusMessage: 'Ya está despachado' })
    const fechaDespacho = parsed.data.fechaDespacho ?? new Date().toISOString().slice(0, 10)
    await prisma.transporteGuardado.update({
      where: { client_id: clientId },
      data: { estado: 'DESPACHADO', fecha_despacho: new Date(fechaDespacho + 'T00:00:00'), updated_at: new Date() },
    })
    await prisma.activityLog.create({
      data: { userId: actor.id, action: 'UPDATE', module: 'transporte', recordId: clientId, details: 'Despachado por operador' },
    }).catch(() => {})
    return { success: true }
  }

  // fecha_entrega: guarda DD/MM/YYYY en la nota
  const [y, m, day] = parsed.data.fecha.split('-')
  const fechaTexto = `${day}/${m}/${y}`
  const notaActual = guardado.nota ?? ''
  const notaNueva = notaActual.match(/\d{1,2}[/\-]\d{1,2}[/\-]\d{4}/)
    ? notaActual.replace(/\d{1,2}[/\-]\d{1,2}[/\-]\d{4}/, fechaTexto)
    : (notaActual ? `${notaActual} ${fechaTexto}` : fechaTexto)

  await prisma.transporteGuardado.update({
    where: { client_id: clientId },
    data: { nota: notaNueva, updated_at: new Date() },
  })
  await prisma.activityLog.create({
    data: { userId: actor.id, action: 'UPDATE', module: 'transporte', recordId: clientId, details: `Fecha entrega: ${fechaTexto}` },
  }).catch(() => {})

  return { success: true, nota: notaNueva }
})
