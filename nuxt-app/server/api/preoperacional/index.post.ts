import { defineEventHandler, readBody, createError, setResponseStatus } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { mapInspeccion } from '../../utils/mapRow'
import { CHECKLIST_PREOPERACIONAL, estadoDesdeItems, todayISO, type ResultadoInspeccion } from '../../utils/preoperacional'

const itemSchema = z.object({
  item: z.string().min(1),
  resultado: z.enum(['CONFORME', 'NO_CONFORME', 'NO_APLICA']),
  observacion: z.string().nullable().optional(),
  fotoUrl: z.string().url().nullable().optional(),
})

const createSchema = z.object({
  kilometraje: z.number().int().min(0).nullable().optional(),
  observaciones: z.string().nullable().optional(),
  items: z.array(itemSchema).min(CHECKLIST_PREOPERACIONAL.length),
})

async function getTransportista(userId: string) {
  return prisma.transportista.findFirst({ where: { userId, activo: true }, include: { vehiculo: true } })
}

// POST /api/preoperacional — el conductor registra el checklist de hoy.
export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, ['TRANSPORTISTA'])

  const transportista = await getTransportista(actor.id)
  if (!transportista) throw createError({ statusCode: 409, statusMessage: 'Tu usuario no esta vinculado a un transportista activo' })
  if (!transportista.vehiculoId) throw createError({ statusCode: 409, statusMessage: 'No tienes vehiculo asignado para registrar preoperacional' })

  const parsed = createSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })

  const byName = new Map(CHECKLIST_PREOPERACIONAL.map((item) => [item.item, item]))
  const items: Array<{
    categoria: string
    item: string
    resultado: ResultadoInspeccion
    esCritico: boolean
    fotoUrl: string | null
    observacion: string | null
  }> = []
  for (const incoming of parsed.data.items) {
    const base = byName.get(incoming.item)
    if (!base) throw createError({ statusCode: 400, statusMessage: 'Item de checklist invalido' })
    items.push({
      categoria: base.categoria,
      item: base.item,
      resultado: incoming.resultado as ResultadoInspeccion,
      esCritico: base.esCritico,
      fotoUrl: incoming.fotoUrl ?? null,
      observacion: incoming.observacion?.trim() || null,
    })
  }

  const estado = estadoDesdeItems(items)
  const fecha = new Date(todayISO())

  const inspeccion = await prisma.$transaction(async (tx) => {
    await tx.inspeccionPreoperacional.updateMany({
      where: { conductorId: transportista.id, fecha, vigente: true },
      data: { vigente: false },
    })

    const row = await tx.inspeccionPreoperacional.create({
      data: {
        vehiculoId: transportista.vehiculoId!,
        conductorId: transportista.id,
        realizadoPorId: actor.id,
        fecha,
        kilometraje: parsed.data.kilometraje ?? null,
        observaciones: parsed.data.observaciones?.trim() || null,
        estado,
        vigente: true,
        items: { create: items },
      },
      include: { vehiculo: true, conductor: true, items: true },
    })

    await tx.activityLog.create({
      data: {
        userId: actor.id,
        action: 'CREATE',
        module: 'preoperacional',
        recordId: row.id,
        details: `${row.vehiculo.placa} - ${estado}`,
      },
    }).catch(() => {})

    return row
  })

  setResponseStatus(event, 201)
  return { success: true, data: mapInspeccion(inspeccion) }
})
