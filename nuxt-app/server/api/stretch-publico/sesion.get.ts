import { defineEventHandler, setHeader } from 'h3'
import { prisma } from '../../utils/prisma'
import { sesionStretch } from '../../utils/stretch'
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'no-store')
  const s = await sesionStretch(event, prisma)
  return { nombre: s.nombre, expiraAt: s.expiraAt }
})
