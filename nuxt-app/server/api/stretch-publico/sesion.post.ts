import { createError, defineEventHandler, readBody, setCookie } from 'h3'
import { randomBytes } from 'node:crypto'
import { prisma } from '../../utils/prisma'
import { COOKIE_STRETCH, hashStretch, lockStretch } from '../../utils/stretch'
export default defineEventHandler(async event => {
  const b = await readBody(event)
  if (typeof b?.codigo !== 'string' || !/^[a-f0-9]{64}$/.test(b.codigo)) throw createError({ statusCode: 400, statusMessage: 'Código inválido' })
  return prisma.$transaction(async tx => {
    await lockStretch(tx)
    const s = await tx.stretchSesion.findUnique({ where: { tokenHash: hashStretch(b.codigo) } })
    if (!s || s.activada || s.revocadaAt || s.expiraAt <= new Date()) throw createError({ statusCode: 401, statusMessage: 'Código vencido o ya utilizado. Solicita otro a Eduardo o Felipe.' })
    const token = randomBytes(32).toString('hex')
    await tx.stretchSesion.update({ where: { id: s.id }, data: { tokenHash: hashStretch(token), activada: true } })
    setCookie(event, COOKIE_STRETCH, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/dashboard/api/stretch-publico', maxAge: Math.floor((s.expiraAt.getTime() - Date.now()) / 1000) })
    return { ok: true, nombre: s.nombre, expiraAt: s.expiraAt }
  })
})
