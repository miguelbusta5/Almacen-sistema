import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { auditar, ORDEN_INCLUDE, requireInspeccion } from '../../utils/muebles'
import { codigoContado, validarFacturaContado } from '../../utils/mueblesCalc'
import { todayBogota } from '../../utils/exportacionesCalc'
import { mapOrdenMuebles } from '../../utils/mapRow'

const schema = z.object({
  inspectorId: z.string().min(1),
  factura: z.string().min(1).max(40),
  cliente: z.string().max(160).nullable().optional(),
})

/**
 * POST /api/inspeccion-muebles/contado - factura de contado.
 *
 * La mercancia que llega de tienda no tiene orden de NetSuite, asi que no pasa
 * por picking: la orden nace aqui, ya en inspeccion, con el numero de factura
 * como codigo. Los PLU se agregan uno a uno desde la orden.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireInspeccion(event)

  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const d = parsed.data

  const error = validarFacturaContado(d.factura)
  if (error) throw createError({ statusCode: 400, statusMessage: error })
  const codigo = codigoContado(d.factura)

  const inspector = await prisma.inspector.findFirst({
    where: { id: d.inspectorId, activo: true },
    select: { id: true, nombre: true },
  })
  if (!inspector) throw createError({ statusCode: 404, statusMessage: 'Inspector no encontrado' })

  const repetida = await prisma.ordenMuebles.findFirst({ where: { codigo, deletedAt: null }, select: { id: true } })
  if (repetida) throw createError({ statusCode: 409, statusMessage: 'Ya existe una orden con esa factura' })

  // El reloj de picking nace y muere en el mismo instante: aqui nadie pickeo.
  const now = new Date()
  const orden = await prisma.$transaction(async (tx) => {
    const creada = await tx.ordenMuebles.create({
      data: {
        codigo,
        tipoOrden: 'CONTADO',
        estado: 'EN_INSPECCION',
        fecha: todayBogota(now),
        horaInicio: now,
        horaPasoInspeccion: now,
        operarioId: actor.id,
        inspectorId: inspector.id,
        cliente: d.cliente?.trim() || null,
      },
      select: { id: true },
    })
    await tx.inspectorOrdenMuebles.create({ data: { ordenId: creada.id, inspectorId: inspector.id } })
    return tx.ordenMuebles.findUniqueOrThrow({ where: { id: creada.id }, include: ORDEN_INCLUDE })
  })

  await auditar(
    actor.id, 'CREATE', 'inspeccion-muebles', orden.id,
    `Factura de contado ${codigo} creada por ${inspector.nombre}`,
  )

  return { success: true, data: mapOrdenMuebles(orden) }
})
