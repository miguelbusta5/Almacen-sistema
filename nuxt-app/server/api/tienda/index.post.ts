import { defineEventHandler, readBody, createError, setResponseStatus } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { requireCan } from '../../utils/auth'
import { mapDespacho } from '../../utils/mapRow'
import { derivePlinFromMaestro, normalizePlu, productoToClient } from '../../utils/productosMaestro'

const plinSchema = z.object({
  plu: z.string().min(1).max(100),
  descripcion: z.string().max(255).nullable().optional(),
  unidades: z.number().int().min(1),
})

const createSchema = z.object({
  centroCostos: z.string().min(1).max(100),
  numeroDocumento: z.string().min(1).max(100),
  consecutivo: z.string().min(1).max(50),
  clienteNombre: z.string().min(1).max(255),
  clienteDocumento: z.string().max(50).nullable().optional(),
  clienteTelefono: z.string().max(30).nullable().optional(),
  fechaCreacion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fechaEntregaComprometida: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  numeroCajas: z.number().int().min(1).nullable().optional(),
  notaEntrega: z.string().nullable().optional(),
  ciudad: z.string().max(100).nullable().optional(),
  plines: z.array(plinSchema).optional(),
})

// POST /api/tienda
export default defineEventHandler(async (event) => {
  const actor = await requireCan(event, 'create')
  const body = await readBody(event)
  if (!body.fechaCreacion) body.fechaCreacion = new Date().toISOString().slice(0, 10)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]!.message })
  const d = parsed.data

  const row = await prisma.$transaction(async (tx) => {
    const despacho = await tx.despachoTienda.create({
      data: {
        centroCostos: d.centroCostos,
        numeroDocumento: d.numeroDocumento,
        consecutivo: d.consecutivo,
        clienteNombre: d.clienteNombre,
        clienteDocumento: d.clienteDocumento ?? null,
        clienteTelefono: d.clienteTelefono ?? null,
        fechaCreacion: new Date(d.fechaCreacion + 'T00:00:00'),
        fechaEntregaComprometida: d.fechaEntregaComprometida ? new Date(d.fechaEntregaComprometida + 'T00:00:00') : null,
        numeroCajas: d.numeroCajas ?? null,
        notaEntrega: d.notaEntrega ?? null,
        ciudad: d.ciudad ?? null,
        creadoPorId: actor.id,
      },
      include: { creadoPor: { select: { id: true, name: true } }, plines: true, guardadoPendiente: { include: { asignadoA: { select: { name: true } } } } },
    })

    if (d.plines && d.plines.length > 0) {
      const normalizedPlus = [...new Set(d.plines.map((p) => normalizePlu(p.plu)).filter(Boolean))]
      const productos = normalizedPlus.length > 0
        ? await tx.productoMaestro.findMany({
            where: { plu: { in: normalizedPlus } },
            select: { plu: true, descripcion: true, fabricante: true, precio: true, marca: true },
          })
        : []
      const productosByPlu = new Map(productos.map((p) => [p.plu, productoToClient(p)]))
      await tx.plinDespacho.createMany({
        data: d.plines.map((p) => {
          const plu = normalizePlu(p.plu)
          const derived = derivePlinFromMaestro(
            { descripcion: p.descripcion ?? null },
            productosByPlu.get(plu) ?? null,
            actor.role === 'ADMIN',
          )
          return {
            despachoId: despacho.id,
            plu,
            descripcion: derived.descripcion ?? null,
            unidades: p.unidades,
          }
        }),
      })
    }

    return tx.despachoTienda.findUnique({
      where: { id: despacho.id },
      include: { creadoPor: { select: { id: true, name: true } }, plines: true, guardadoPendiente: { include: { asignadoA: { select: { name: true } } } } },
    })
  })

  await prisma.activityLog.create({
    data: { userId: actor.id, action: 'CREATE', module: 'tienda', recordId: row!.id, details: `${d.numeroDocumento} · ${d.clienteNombre} · ${d.centroCostos}` },
  }).catch(() => {})

  const responsables = await prisma.user.findMany({
    where: { active: true, role: { in: ['SUPERVISOR_TRANSPORTE', 'GERENTE', 'ADMIN'] } },
    select: { id: true },
  }).catch(() => [])
  const destinatariosIds = new Set(responsables.map((u) => u.id))
  destinatariosIds.delete(actor.id)
  if (destinatariosIds.size > 0) {
    await prisma.notificacion.createMany({
      data: Array.from(destinatariosIds).map((userId) => ({
        userId,
        titulo: 'Nueva factura contado pendiente de recogida',
        descripcion: `Doc. ${d.numeroDocumento} · ${d.clienteNombre} · ${d.centroCostos}`,
        tipo: 'TIENDA',
        enlace: '/dashboard/tienda',
      })),
    }).catch(() => {})
  }

  setResponseStatus(event, 201)
  return { success: true, data: mapDespacho(row!) }
})
