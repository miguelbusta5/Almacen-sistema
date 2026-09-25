import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { auditar, destinoDeTienda, equipoDelDia, ORDEN_INCLUDE, requireInspeccion } from '../../utils/muebles'
import { derivarTipoOrden, normalizarCodigoOrden, ROL_PICKING, validarCodigoOrden } from '../../utils/mueblesCalc'
import { todayBogota } from '../../utils/exportacionesCalc'
import { mapOrdenMuebles } from '../../utils/mapRow'

const schema = z.object({
  inspectorId: z.string().min(1),
  orden: z.string().min(1).max(40),
  operarioId: z.string().min(1),
  cliente: z.string().max(160).nullable().optional(),
  /** Tienda a la que va (de ella sale la ciudad). */
  destino: z.object({
    tiendaCodigo: z.string().min(1).max(50),
    ciudad: z.string().max(80).nullable().optional(),
  }).optional(),
})

/**
 * POST /api/inspeccion-muebles/sin-crear - orden SIN CREAR (24-09).
 *
 * Una OVDM/TSDM que se pickeo en el CEDI pero el operario de picking no la
 * registro en el modulo: llega a inspeccion sin existir. La crea el inspector,
 * a nombre del operario que la pickeo (asi sus PLU le cuentan y se ve cuantas
 * deja sin registrar). No hay tiempo de picking: el reloj nace y muere en el
 * mismo instante y `sinCrearPicking` la saca de los promedios de tiempo.
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

  const [inspector, operario, repetida] = await Promise.all([
    prisma.inspector.findFirst({ where: { id: d.inspectorId, activo: true }, select: { id: true, nombre: true } }),
    prisma.user.findFirst({ where: { id: d.operarioId, role: ROL_PICKING, active: true }, select: { id: true, name: true } }),
    prisma.ordenMuebles.findFirst({ where: { codigo, deletedAt: null }, select: { estado: true } }),
  ])
  if (!inspector) throw createError({ statusCode: 404, statusMessage: 'Inspector no encontrado' })
  if (!operario) throw createError({ statusCode: 400, statusMessage: 'Elige el operario de picking que saco la orden' })
  // Si ya existe, el operario si la registro: se trabaja esa.
  if (repetida) throw createError({ statusCode: 409, statusMessage: `La orden ${codigo} ya existe en muebles: búscala en la lista` })

  // El equipo del dia del operario, si tiene: la carga de la orden es suya.
  const equipo = await equipoDelDia(operario.id)
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
        operarioId: operario.id,
        equipoId: equipo?.id ?? null,
        inspectorId: inspector.id,
        cliente: d.cliente?.trim() || null,
        ...(destino ?? {}),
        sinCrearPicking: true,
        // Participante ya salido: no le ocupa el turno (ordenAbierta solo mira EN_PICKING).
        participantes: {
          create: { usuarioId: operario.id, equipoId: equipo?.id ?? null, esCreador: true, seUnioAt: now, salioAt: now },
        },
      },
      select: { id: true },
    })
    await tx.inspectorOrdenMuebles.create({ data: { ordenId: creada.id, inspectorId: inspector.id } })
    return tx.ordenMuebles.findUniqueOrThrow({ where: { id: creada.id }, include: ORDEN_INCLUDE })
  })

  await auditar(
    actor.id, 'CREATE', 'inspeccion-muebles', orden.id,
    `Orden sin crear ${codigo} (pickeo ${operario.name}) creada por ${inspector.nombre}`,
  )

  return { success: true, data: mapOrdenMuebles(orden) }
})
