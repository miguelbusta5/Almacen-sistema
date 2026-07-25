// POST /api/exportaciones/mover — GLOBAL, no parametrizado por país: recibe
// origenPais/destinoPais en el body y opera sobre cualquier par. Vive bajo
// /exportaciones igual que en la app Next (los 3 módulos de UI llaman esta misma
// URL). Solo ADMIN. Port de src/lib/exportaciones/mover.ts.
// Los 3 modelos tienen forma idéntica, así que "mover" = copiar la fila al modelo
// destino + borrado lógico en el origen. Genera un id nuevo (no preserva el original).
import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { getExportDelegate, PAISES_EXPORT_SRV, type PaisExport } from '../../utils/exportaciones'

const paisSchema = z.enum(['ecuador', 'mexico', 'eeuu'])

const bodySchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1).max(200),
    origenPais: paisSchema,
    destinoPais: paisSchema,
    motivo: z.string().min(5),
  })
  .refine((d) => d.origenPais !== d.destinoPais, {
    message: 'El país destino debe ser distinto al país origen',
    path: ['destinoPais'],
  })

interface RegistroMovible {
  id: string
  numeroCaja: string
  plu: string
  descripcion: string
  unidadEmpaque: number
  fecha: Date
  horaInicio: Date
  horaFinalizacion: Date | null
  hayReguero: boolean
  cantidadReguero: number | null
  creadoPorId: string
  deletedAt: Date | null
}

export default defineEventHandler(async (event) => {
  const actor = await requireRole(event, ['ADMIN'])

  const parsed = bodySchema.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  }
  const { ids, origenPais, destinoPais, motivo } = parsed.data

  const origenCfg = PAISES_EXPORT_SRV[origenPais as PaisExport]
  const destinoCfg = PAISES_EXPORT_SRV[destinoPais as PaisExport]
  const origenDelegate = getExportDelegate(origenPais as PaisExport)
  const destinoDelegate = getExportDelegate(destinoPais as PaisExport)

  const registros = await Promise.all(ids.map((id) => origenDelegate.findUnique({ where: { id } })))

  const motivoTexto = motivo.trim()
  const newIds: string[] = []
  const notFound: string[] = []

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i]!
    const record = registros[i] as RegistroMovible | null

    if (!record || record.deletedAt) {
      notFound.push(id)
      continue
    }

    const [created] = await prisma.$transaction([
      destinoDelegate.create({
        data: {
          numeroCaja: record.numeroCaja,
          plu: record.plu,
          descripcion: record.descripcion,
          unidadEmpaque: record.unidadEmpaque,
          fecha: record.fecha,
          horaInicio: record.horaInicio,
          horaFinalizacion: record.horaFinalizacion,
          hayReguero: record.hayReguero,
          cantidadReguero: record.cantidadReguero,
          creadoPorId: record.creadoPorId,
          actualizadoPorId: actor.id,
          motivoCorreccion: motivoTexto,
        },
      }),
      origenDelegate.update({
        where: { id },
        data: { deletedAt: new Date(), actualizadoPorId: actor.id, motivoCorreccion: motivoTexto },
      }),
    ])

    newIds.push(created.id)

    await prisma.activityLog.createMany({
      data: [
        {
          userId: actor.id,
          action: 'MOVE',
          module: origenCfg.moduleKey,
          recordId: id,
          details: `Movido a Exportaciones ${destinoCfg.paisLabel}: ${motivoTexto}`,
        },
        {
          userId: actor.id,
          action: 'MOVE',
          module: destinoCfg.moduleKey,
          recordId: created.id,
          details: `Recibido desde Exportaciones ${origenCfg.paisLabel}: ${motivoTexto}`,
        },
      ],
    }).catch(() => {})
  }

  if (newIds.length === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Ningún registro pudo moverse (no encontrado o ya borrado)',
    })
  }

  return { success: true, moved: newIds.length, newIds, notFound }
})
