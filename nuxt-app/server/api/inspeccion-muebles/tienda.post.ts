import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { auditar, destinoDeTienda, ORDEN_INCLUDE, requireInspeccion } from '../../utils/muebles'
import { derivarTipoOrden, normalizarCodigoOrden, validarCodigoOrden } from '../../utils/mueblesCalc'
import { todayBogota } from '../../utils/exportacionesCalc'
import { mapOrdenMuebles } from '../../utils/mapRow'

const schema = z.object({
  inspectorId: z.string().min(1),
  orden: z.string().min(1).max(40),
  tiendaCodigo: z.string().min(1).max(50),
  cliente: z.string().max(160).nullable().optional(),
  /** Tienda a la que va (de ella sale la ciudad). */
  destino: z.object({
    tiendaCodigo: z.string().min(1).max(50),
    ciudad: z.string().max(80).nullable().optional(),
  }).optional(),
})

/**
 * POST /api/inspeccion-muebles/tienda - orden que llega DE TIENDA.
 *
 * Tiene su OVDM/TSDM de NetSuite, pero la mercancia viene de una tienda y no se
 * pickea en el CEDI: nace aqui, ya en inspeccion, como el contado. Lo que la
 * distingue es la tienda de origen (del maestro de tiendas), sellada con su
 * nombre para que el historico no cambie si el catalogo se edita.
 *
 * No es contado: hasta el 23-09 se registraba como "CONTADO-OVDM…" por falta de
 * esta opcion, y eso mezclaba las dos cosas en los indicadores.
 */
export default defineEventHandler(async (event) => {
  const actor = await requireInspeccion(event)

  const parsed = schema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const d = parsed.data

  const error = validarCodigoOrden(d.orden)
  if (error) throw createError({ statusCode: 400, statusMessage: error })
  const codigo = normalizarCodigoOrden(d.orden)

  const [inspector, tienda, repetida] = await Promise.all([
    prisma.inspector.findFirst({ where: { id: d.inspectorId, activo: true }, select: { id: true, nombre: true } }),
    prisma.maestroTiendaGourmet.findUnique({ where: { codigo: d.tiendaCodigo } }),
    prisma.ordenMuebles.findFirst({ where: { codigo, deletedAt: null }, select: { estado: true } }),
  ])
  if (!inspector) throw createError({ statusCode: 404, statusMessage: 'Inspector no encontrado' })
  if (!tienda || !tienda.activo) {
    throw createError({ statusCode: 400, statusMessage: 'La tienda de origen no existe o esta inactiva en el maestro' })
  }
  // La misma orden no puede estar dos veces: si ya se pickeo en el CEDI, es esa.
  if (repetida) throw createError({ statusCode: 409, statusMessage: `La orden ${codigo} ya existe en muebles` })

  // El reloj de picking nace y muere en el mismo instante: en el CEDI nadie la pickeo.
  const destino = d.destino ? await destinoDeTienda(d.destino.tiendaCodigo, d.destino.ciudad) : null
  const now = new Date()
  const orden = await prisma.$transaction(async (tx) => {
    const creada = await tx.ordenMuebles.create({
      data: {
        codigo,
        tipoOrden: derivarTipoOrden(codigo),
        estado: 'EN_INSPECCION',
        fecha: todayBogota(now),
        horaInicio: now,
        horaPasoInspeccion: now,
        operarioId: actor.id,
        inspectorId: inspector.id,
        cliente: d.cliente?.trim() || null,
        ...(destino ?? {}),
        tiendaOrigenCodigo: tienda.codigo,
        tiendaOrigenNombre: tienda.tienda,
      },
      select: { id: true },
    })
    await tx.inspectorOrdenMuebles.create({ data: { ordenId: creada.id, inspectorId: inspector.id } })
    return tx.ordenMuebles.findUniqueOrThrow({ where: { id: creada.id }, include: ORDEN_INCLUDE })
  })

  await auditar(
    actor.id, 'CREATE', 'inspeccion-muebles', orden.id,
    `Orden de tienda ${codigo} (${tienda.tienda}) creada por ${inspector.nombre}`,
  )

  return { success: true, data: mapOrdenMuebles(orden) }
})
