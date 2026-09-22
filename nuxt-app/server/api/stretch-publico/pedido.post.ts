import { createError, defineEventHandler, readBody } from 'h3'
import { prisma } from '../../utils/prisma'
import { avisarStretch, lockStretch, pedidoStretch, sesionStretch } from '../../utils/stretch'
export default defineEventHandler(async event => {
  const parsed = pedidoStretch.safeParse(await readBody(event))
  if (!parsed.success || parsed.data.tipo !== 'INTERNO') throw createError({ statusCode: 400, statusMessage: 'Indica tu nombre, área y cantidad entera de rollos para uso interno' })
  const b = parsed.data
  return prisma.$transaction(async tx => {
    await lockStretch(tx)
    const sesion = await sesionStretch(event, tx)
    const previo = await tx.stretchPedido.findUnique({ where: { id: b.id } })
    if (previo) {
      if (previo.sesionId !== sesion.id || previo.solicitante !== b.solicitante || previo.rollos !== b.rollos || previo.destino !== b.destino) throw createError({ statusCode: 409, statusMessage: 'Solicitud repetida con otros datos' })
      return { ok: true, id: previo.id }
    }
    if (await tx.stretchPedido.count({ where: { sesionId: sesion.id, createdAt: { gte: new Date(Date.now() - 3600000) } } }) >= 60) throw createError({ statusCode: 429, statusMessage: 'Demasiadas solicitudes en esta sesión. Contacta a Eduardo o Felipe.' })
    await tx.stretchPedido.create({ data: { ...b, sesionId: sesion.id } })
    await avisarStretch(tx, b.solicitante, b.rollos)
    return { ok: true, id: b.id }
  }, { timeout: 15000 })
})
