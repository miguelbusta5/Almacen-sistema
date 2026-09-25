import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { auditarCargue, requireCargue } from '../../../utils/cargueCamion'
import { normalizarTextoCargue } from '../../../utils/cargueCamionCalc'

const schema = z.object({ nombre: z.string().max(120) })

/** POST /api/cargue-camiones/operarios - agrega una persona al catalogo. Solo ADMIN. */
export default defineEventHandler(async (event) => {
  const actor = await requireCargue(event)
  if (actor.role !== 'ADMIN') throw createError({ statusCode: 403, statusMessage: 'Solo el administrador edita la lista de quienes cargan' })
  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  const nombre = normalizarTextoCargue(parsed.data.nombre)
  if (nombre.length < 3) throw createError({ statusCode: 400, statusMessage: 'Escribe el nombre completo' })
  const existe = await prisma.operarioCargue.findFirst({ where: { nombre: { equals: nombre, mode: 'insensitive' } } })
  if (existe) throw createError({ statusCode: 409, statusMessage: `${nombre} ya esta en la lista${existe.activo ? '' : ' (inactivo: activalo)'}` })
  const creado = await prisma.operarioCargue.create({ data: { nombre }, select: { id: true, nombre: true, activo: true } })
  await auditarCargue(actor.id, 'CREATE', creado.id, `Operario de cargue agregado: ${nombre}`)
  return { success: true, data: creado }
})
