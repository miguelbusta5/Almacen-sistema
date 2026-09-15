import { defineEventHandler } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireAuth } from '../../utils/auth'
import { assertPuedePausar } from '../../utils/pausasOperativas'

export default defineEventHandler(async (event) => {
  const actor = await requireAuth(event)
  assertPuedePausar(actor.role)
  const data = await prisma.pausaOperativa.findUnique({ where: { activaUsuarioId: actor.id } })
  return { success: true, data }
})
